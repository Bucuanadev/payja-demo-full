import sqlite3
import json
import requests
import datetime

DB_PATH = '/root/payja-demo-full/backend/prisma/dev.db'
BANCO_API_URL = 'http://localhost:4500/api/payja-decisions'

def sync_decisions():
    print('🔄 Iniciando sincronização de decisões do PayJA para o Banco Mock (via Python)...')
    
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Query para pegar a última decisão de cada cliente
        query = '''
            SELECT c.nuit, c.name, c.phoneNumber, s.decision, s.maxAmount, s.factors, s.calculatedAt
            FROM customers c
            JOIN scoring_results s ON c.id = s.customerId
            WHERE s.id IN (SELECT MAX(id) FROM scoring_results GROUP BY customerId)
        '''
        
        cursor.execute(query)
        rows = cursor.fetchall()
        
        print(f'📊 Encontrados {len(rows)} resultados de scoring para sincronizar.')
        
        for row in rows:
            nuit, name, phone, decision, max_amount, factors_json, calculated_at = row
            
            try:
                factors = json.loads(factors_json)
                bank_reason = factors.get('bankReason', '')
                
                payload = {
                    'nuit': nuit,
                    'nome_completo': name,
                    'telefone': phone,
                    'decision': 'APPROVED' if decision == 'APPROVED' else 'REJECTED',
                    'creditLimit': max_amount,
                    'rejectionReasons': bank_reason.split(' | ') if bank_reason else [],
                    'score': 0, # Final score não está na query simples mas podemos adicionar se necessário
                    'decidedAt': calculated_at
                }
                
                response = requests.post(BANCO_API_URL, json=payload)
                if response.status_code == 200:
                    print(f'✅ Sincronizado: {nuit} ({decision})')
                else:
                    print(f'⚠️ Falha ao sincronizar {nuit}: {response.text}')
                    
            except Exception as e:
                print(f'❌ Erro ao processar {nuit}: {str(e)}')
                
        conn.close()
        print('🏁 Sincronização concluída.')
        
    except Exception as e:
        print(f'❌ Erro geral na sincronização: {str(e)}')

if __name__ == '__main__':
    sync_decisions()
