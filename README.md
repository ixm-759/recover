# Recover NFT Script

## Configuración Previa

1.  **Copiar el archivo de entorno de ejemplo:**

    ```bash
    cp .env-example .env
    ```

2.  **Configurar las variables de entorno:**
    Abre el archivo `.env` y rellena los siguientes datos:

    *   `RPC_URL`: La URL del nodo RPC (por ejemplo, `https://bsc.blockpi.network/v1/rpc/private`).
    *   `COMPROMISED_PK`: La clave privada de la wallet comprometida (debe empezar con `0x`).
    *   `FUNDING_PK`: La clave privada de una wallet con BNB que pagará el gas de las transacciones (para no enviar BNB antes y alertar al sweeper).
    *   `SAFE_WALLET`: La dirección pública de la wallet segura donde recibirás el NFT.

## Instalación

Instala las dependencias necesarias ejecutando:

```bash
npm install
```

## Ejecución

Para ejecutar el script principal:

```bash
npx ts-node main.ts
```

El script realizará lo siguiente:
1.  Simulará la migración para obtener el `veTokenId`.
2.  Construirá y enviará la transacción de migración.
3.  Construirá y enviará la transacción para transferir el NFT a la wallet segura.
