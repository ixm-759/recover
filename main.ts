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

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(COMPROMISED_PK, provider);

  console.log("🔐 Wallet comprometida:", wallet.address);
  console.log("🛡️ Wallet segura:", SAFE_WALLET);

  const vault = new ethers.Contract(VAULT, VAULT_ABI, wallet);
  const nft = new ethers.Contract(VE_NFT, NFT_ABI, wallet);

  // 1️⃣ Simulación (NO escribe en chain)
  const veTokenId: bigint = await vault.migrateToVotingEscrow.staticCall(
    [PID],
    LOCK_DURATION,
    LOCK_TYPE
  );

  console.log("🎟️ veTokenId esperado:", veTokenId.toString());

  // 2️⃣ Nonce
  const nonce = await provider.getTransactionCount(wallet.address, "latest");

  // 3️⃣ TX migrate
  const migrateTx = await vault.migrateToVotingEscrow.populateTransaction(
    [PID],
    LOCK_DURATION,
    LOCK_TYPE
  );

  migrateTx.nonce = nonce;
  migrateTx.gasLimit = 700_000n;
  migrateTx.gasPrice = ethers.parseUnits("6", "gwei");

  // 4️⃣ TX transfer
  const transferTx = await nft.transferFrom.populateTransaction(
    wallet.address,
    SAFE_WALLET,
    veTokenId
  );

  transferTx.nonce = nonce + 1;
  transferTx.gasLimit = 300_000n;
  transferTx.gasPrice = ethers.parseUnits("6", "gwei");

  // 🚀 ENVÍO SECUENCIAL (MISMO RPC PRIVADO)
  console.log("🚀 Enviando migrate...");
  const sentMigrate = await wallet.sendTransaction(migrateTx);
  console.log("TX migrate:", sentMigrate.hash);

  console.log("🚀 Enviando transfer NFT...");
  const sentTransfer = await wallet.sendTransaction(transferTx);
  console.log("TX transfer:", sentTransfer.hash);

  console.log("⏳ Esperando confirmación...");
  await Promise.all([sentMigrate.wait(), sentTransfer.wait()]);

  console.log("✅ Rescate completado con éxito");
}

main().catch((err) => {
  console.error("❌ Error en rescate:", err);
  process.exit(1);
});
