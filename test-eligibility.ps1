Start-Sleep -Seconds 3

$body = @{
    nuit = "100234567"
    nome = "João Pedro da Silva"
    bi = "1234567890123N"
} | ConvertTo-Json

Write-Host "Testing Eligibility API..."

try {
    $response = Invoke-RestMethod -Uri "http://localhost:4000/api/validacao/verificar" `
      -Method POST `
      -Headers @{
        "x-api-key" = "banco-ghw-api-key-2025"
        "Content-Type" = "application/json"
      } `
      -Body $body
    
    Write-Host "SUCCESS - Response:"
    $response | ConvertTo-Json -Depth 15
} catch {
    Write-Host "ERROR: $_"
}
