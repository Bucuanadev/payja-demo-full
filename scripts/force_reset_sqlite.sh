#!/bin/bash
DB_PATH="/root/payja-demo-full/backend/prisma/dev.db"

if [ -f "$DB_PATH" ]; then
    echo "Iniciando limpeza via SQLite em $DB_PATH..."
    # Instalar sqlite3 se não existir
    if ! command -v sqlite3 &> /dev/null; then
        apt-get update && apt-get install -y sqlite3
    fi
    
    sqlite3 "$DB_PATH" "DELETE FROM ScoringResult;"
    sqlite3 "$DB_PATH" "DELETE FROM LoanInstallment;"
    sqlite3 "$DB_PATH" "DELETE FROM Loan;"
    sqlite3 "$DB_PATH" "DELETE FROM Customer;"
    echo "✓ Limpeza concluída!"
else
    echo "Erro: Base de dados não encontrada em $DB_PATH"
    exit 1
fi
