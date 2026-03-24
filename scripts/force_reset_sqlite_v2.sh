#!/bin/bash
DB_PATH="/root/payja-demo-full/backend/prisma/dev.db"

if [ -f "$DB_PATH" ]; then
    echo "Iniciando limpeza via SQLite em $DB_PATH..."
    sqlite3 "$DB_PATH" "DELETE FROM scoring_results;"
    sqlite3 "$DB_PATH" "DELETE FROM installments;"
    sqlite3 "$DB_PATH" "DELETE FROM loans;"
    sqlite3 "$DB_PATH" "DELETE FROM customers;"
    echo "✓ Limpeza concluída!"
else
    echo "Erro: Base de dados não encontrada em $DB_PATH"
    exit 1
fi
