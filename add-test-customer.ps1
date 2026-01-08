$body = @{
    phoneNumber = "874567890"
    name = "Ana Isabel Cossa"
    nuit = "123456789"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:3002/api/customers/register" -Method Post -Body $body -ContentType "application/json"

Write-Host "Cliente registrado com sucesso!"
$response | ConvertTo-Json -Depth 10
