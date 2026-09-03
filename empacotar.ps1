# empacotar.ps1 — gera o .zip para enviar ao Edge Add-ons / Chrome Web Store.
# Uso:  powershell -ExecutionPolicy Bypass -File .\empacotar.ps1
# Sai:  pausar-streamyard-teleprompter-<versao>.zip na pasta acima desta.

$ErrorActionPreference = "Stop"
$raiz = $PSScriptRoot

$versao = (Get-Content (Join-Path $raiz "manifest.json") -Raw | ConvertFrom-Json).version
$saida = Join-Path (Split-Path $raiz -Parent) "pausar-streamyard-teleprompter-$versao.zip"

# só o que a extensão precisa para rodar: nada de .git, store/, docs ou scripts
$incluir = @("manifest.json", "src", "pages", "icons")

# staging ao lado da pasta do projeto: $env:TEMP vem em caminho 8.3 e o Remove-Item engasga
$temp = Join-Path (Split-Path $raiz -Parent) (".pacote-tmp-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force $temp | Out-Null
foreach ($item in $incluir) {
  $de = Join-Path $raiz $item
  if (-not (Test-Path $de)) { throw "não achei $item" }
  Copy-Item $de -Destination $temp -Recurse
}

if (Test-Path $saida) { Remove-Item $saida -Force }
Compress-Archive -Path (Join-Path $temp "*") -DestinationPath $saida -CompressionLevel Optimal
Remove-Item $temp -Recurse -Force

$kb = [math]::Round((Get-Item $saida).Length / 1KB, 1)
Write-Host "pacote v$versao pronto: $saida ($kb KB)"
Write-Host "envie esse .zip em https://partner.microsoft.com/dashboard/microsoftedge"
