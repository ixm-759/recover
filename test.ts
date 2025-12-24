import { ethers } from "ethers";
import "dotenv/config";

const RPC_URL = process.env.RPC_URL || "";
const COMPROMISED_PK = process.env.COMPROMISED_PK || "";
const FUNDING_PK = process.env.FUNDING_PK || "";
const SAFE_WALLET = process.env.SAFE_WALLET || "";

async function test() {
  console.log("🔍 Iniciando verificación de configuración...\n");

  // 1. Verificar Variables de Entorno
  if (!RPC_URL) throw new Error("❌ Falta RPC_URL en .env");
  if (!COMPROMISED_PK) throw new Error("❌ Falta COMPROMISED_PK en .env");
  if (!FUNDING_PK) throw new Error("❌ Falta FUNDING_PK en .env");
  if (!SAFE_WALLET) throw new Error("❌ Falta SAFE_WALLET en .env");

  console.log("✅ Variables de entorno detectadas.");

  // 2. Verificar Conexión RPC
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  try {
    const network = await provider.getNetwork();
    const block = await provider.getBlockNumber();
    console.log(`✅ Conexión RPC exitosa. Chain ID: ${network.chainId}, Bloque: ${block}`);
  } catch (error) {
    throw new Error(`❌ Error conectando al RPC: ${error}`);
  }

  // 3. Verificar Wallets
  try {
    const compromisedWallet = new ethers.Wallet(COMPROMISED_PK, provider);
    const fundingWallet = new ethers.Wallet(FUNDING_PK, provider);

    console.log("\n🔐 Wallets Verificadas:");
    console.log(`   🔸 Compromised Address: ${compromisedWallet.address}`);
    console.log(`   🔸 Funding Address:     ${fundingWallet.address}`);
    console.log(`   🔸 Safe Address (Dest): ${SAFE_WALLET}`);

    if (ethers.isAddress(SAFE_WALLET) === false) {
      throw new Error("❌ SAFE_WALLET no es una dirección válida.");
    }

    // 4. Verificar Saldos (Informativo)
    const balanceComp = await provider.getBalance(compromisedWallet.address);
    const balanceFund = await provider.getBalance(fundingWallet.address);

    console.log("\n💰 Saldos Actuales:");
    console.log(`   🔸 Compromised: ${ethers.formatEther(balanceComp)} BNB`);
    console.log(`   🔸 Funding:     ${ethers.formatEther(balanceFund)} BNB`);

    if (balanceFund === 0n) {
      console.warn("⚠️ ADVERTENCIA: La Funding Wallet tiene 0 BNB. Necesitas fondos para pagar el gas.");
    } else {
      console.log("✅ Funding Wallet tiene fondos.");
    }

    console.log("\n✨ Todo parece estar configurado correctamente para ejecutar 'npm start'.");

  } catch (error: any) {
    if (error.code === "INVALID_ARGUMENT") {
      throw new Error("❌ Una de las claves privadas es inválida. Verifica tu .env. (Asegúrate que empiecen con 0x si son hex)");
    }
    throw error;
  }
}

test().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
