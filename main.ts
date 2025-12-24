import "dotenv/config";
import { ethers } from "ethers";

// ================= CONFIG =================

const RPC_URL = process.env.RPC_URL!;
const COMPROMISED_PK = process.env.COMPROMISED_PK!;
const SAFE_WALLET = process.env.SAFE_WALLET!;

const VAULT = "0xcfb6b8b220e877c7d9803bf53da08d78c7f7a535";
const VE_NFT = "0xdf1dd618f3b564765e3ffc9f229637942ef601b2";

const PID = 3;
const LOCK_DURATION = 210 * 24 * 60 * 60; // 210 días
const LOCK_TYPE = 0;

// ================= ABI =================

const VAULT_ABI = [
  "function migrateToVotingEscrow(uint16[] _pids, uint256 _lockDuration, uint8 _lockType) returns (uint256)"
];

const NFT_ABI = [
  "function transferFrom(address from, address to, uint256 tokenId)"
];

// ================= SCRIPT =================

const FUNDING_PK = process.env.FUNDING_PK || "";
// ⚠️ COMPROMISED_PK y SAFE_WALLET ya están definidos arriba, asegúrate de que se lean del env si no lo están
// Para este ejemplo asumiré que se leen de las constantes o process.env si se cambian. 
// Voy a reescribir la parte de las constantes para asegurar que usen process.env

async function main() {
  if (!FUNDING_PK) throw new Error("Falta FUNDING_PK en .env");

  const provider = new ethers.JsonRpcProvider(RPC_URL); // Changed RPC to RPC_URL
  const compromisedWallet = new ethers.Wallet(COMPROMISED_PK, provider);
  const fundingWallet = new ethers.Wallet(FUNDING_PK, provider);

  const vault = new ethers.Contract(VAULT, VAULT_ABI, compromisedWallet);
  const nft = new ethers.Contract(VE_NFT, NFT_ABI, compromisedWallet);

  console.log("💀 Wallet Comprometida:", compromisedWallet.address);
  console.log("💰 Wallet de Fondeo:", fundingWallet.address);
  console.log("🛡️ Wallet Segura (Destino):", SAFE_WALLET);

  // 1️⃣ Preparación de datos (Offline / Call Static)
  console.log("🔄 Simulando migración...");
  const veTokenId = await vault.migrateToVotingEscrow.staticCall(
    [PID],
    LOCK_DURATION,
    LOCK_TYPE
  );
  console.log("🎟️ veTokenId a recuperar:", veTokenId.toString());

  // 2️⃣ Obtener Nonces Actuales
  // Usamos Promise.all para reducir latencia
  const [nonceCompromised, nonceFunding, feeData] = await Promise.all([
    provider.getTransactionCount(compromisedWallet.address, "latest"),
    provider.getTransactionCount(fundingWallet.address, "latest"),
    provider.getFeeData()
  ]);

  // Ajuste de Gas Price (agresivo para ganar a otros bots)
  // Si feeData.maxFeePerGas existe (EIP-1559), úsalo. Si no, usa gasPrice.
  // En BSC a veces es legacy. Forzaremos un poco más del standard.
  const gasPrice = (feeData.gasPrice || ethers.parseUnits("3", "gwei")) * 120n / 100n; // +20%
  console.log(`⛽ Gas Price: ${ethers.formatUnits(gasPrice, "gwei")} gwei`);

  // 3️⃣ Construir Transacciones (Populate)

  // TX A: Migración (Compromised)
  const txMigratePopulated = await vault.migrateToVotingEscrow.populateTransaction(
    [PID],
    LOCK_DURATION,
    LOCK_TYPE
  );
  const gasLimitMigrate = 800_000n; // Hardcoded seguro o estimado

  const txMigrate = {
    ...txMigratePopulated,
    chainId: (await provider.getNetwork()).chainId,
    nonce: nonceCompromised,
    gasLimit: gasLimitMigrate,
    gasPrice,
  };

  // TX B: Transferencia NFT (Compromised)
  const txTransferPopulated = await nft.transferFrom.populateTransaction(
    compromisedWallet.address,
    SAFE_WALLET,
    veTokenId
  );
  const gasLimitTransfer = 350_000n;

  const txTransfer = {
    ...txTransferPopulated,
    chainId: (await provider.getNetwork()).chainId,
    nonce: nonceCompromised + 1,
    gasLimit: gasLimitTransfer,
    gasPrice,
  };

  // 4️⃣ Calcular Gas Total Necesario
  const totalGasLimit = gasLimitMigrate + gasLimitTransfer;
  const totalBnbNeeded = totalGasLimit * gasPrice;
  console.log(`💰 BNB necesario para gas: ${ethers.formatUnits(totalBnbNeeded, "ether")} BNB`);

  // TX C: Fondeo (Funding Wallet -> Compromised Wallet)
  // Enviamos EXACTAMENTE lo necesario para que no sobre nada que el sweeper pueda robar después
  // O un poquito más por seguridad, pero muy poco.
  const txFund = {
    to: compromisedWallet.address,
    value: totalBnbNeeded, // + un pequeño buffer si quieres, p.ej: + ethers.parseEther("0.0001")
    chainId: (await provider.getNetwork()).chainId,
    nonce: nonceFunding,
    gasLimit: 21000n,
    gasPrice,
  };

  // 5️⃣ Firmar Transacciones (Offline)
  console.log("✍️  Firmando transacciones...");
  const signedFund = await fundingWallet.signTransaction(txFund);
  const signedMigrate = await compromisedWallet.signTransaction(txMigrate);
  const signedTransfer = await compromisedWallet.signTransaction(txTransfer);

  // 6️⃣ Enviar en Paralelo (Poor Man's Bundle)
  console.log("🚀 ENVIANDO BUNDLE (Todo simultáneo)...");

  // No usamos await aquí uno por uno para no perder tiempo, lanzamos las promesas
  const p1 = provider.broadcastTransaction(signedFund);
  const p2 = provider.broadcastTransaction(signedMigrate);
  const p3 = provider.broadcastTransaction(signedTransfer);

  try {
    const [sentFund, sentMigrate, sentTransfer] = await Promise.all([p1, p2, p3]);

    console.log(`\n✅ Fondeo Enviado: ${sentFund.hash}`);
    console.log(`✅ Migración Enviada: ${sentMigrate.hash}`);
    console.log(`✅ Transferencia Enviada: ${sentTransfer.hash}`);

    console.log("\n⏳ Esperando confirmaciones...");
    await sentFund.wait();
    console.log("Confirmed: Fondeo");
    await sentMigrate.wait();
    console.log("Confirmed: Migración");
    await sentTransfer.wait();
    console.log("Confirmed: Transferencia");

    console.log("\n🎉 ¡ÉXITO! NFT Rescatado en:", SAFE_WALLET);

  } catch (error) {
    console.error("❌ Error en el broadcast/minado:", error);
  }
}

main().catch((e) => {
  console.error("❌ Error General:", e);
});
