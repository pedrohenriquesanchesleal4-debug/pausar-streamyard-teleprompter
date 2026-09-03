# empacotar.ps1 — gera o .zip para enviar ao Edge Add-ons / Chrome Web Store.
# Uso:  powershell -ExecutionPolicy Bypass -File .\empacotar.ps1
#
# NÃO compacte a pasta do projeto na mão: isso leva .git, docs e o próprio .zip
# para dentro do pacote, e a loja recusa com
# "The uploaded package consists of a compressed file".
# O pacote tem de ter manifest.json na RAIZ do zip e nenhum arquivo compactado dentro.

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression.FileSystem

$raiz = $PSScriptRoot
$versao = (Get-Content (Join-Path $raiz "manifest.json") -Raw | ConvertFrom-Json).version

# sai FORA da árvore do projeto, para nunca acabar dentro de um zip da pasta
$destino = Split-Path (Split-Path $raiz -Parent) -Parent
$saida = Join-Path $destino "pausar-streamyard-teleprompter-$versao.zip"

# só o que a extensão precisa para rodar
$incluir = @("manifest.json", "src", "pages", "icons")

# staging fora do projeto: $env:TEMP vem em caminho 8.3 e o Remove-Item engasga
$temp = Join-Path $destino (".pacote-tmp-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force $temp | Out-Null
try {
  foreach ($item in $incluir) {
    $de = Join-Path $raiz $item
    if (-not (Test-Path $de)) { throw "não achei $item" }
    Copy-Item $de -Destination $temp -Recurse
  }

  if (Test-Path $saida) { Remove-Item $saida -Force }
  Compress-Archive -Path (Join-Path $temp "*") -DestinationPath $saida -CompressionLevel Optimal
} finally {
  if (Test-Path $temp) { Remove-Item $temp -Recurse -Force }
}

# ---- confere o pacote antes de você subir ----
$zip = [System.IO.Compression.ZipFile]::OpenRead($saida)
try {
  $nomes = $zip.Entries | ForEach-Object { $_.FullName }
} finally {
  $zip.Dispose()
}

$problemas = @()
if ($nomes -notcontains "manifest.json") {
  $problemas += "manifest.json não está na raiz do zip"
}
$compactados = $nomes | Where-Object { $_ -match '\.(zip|rar|7z|gz|crx)$' }
if ($compactados) {
  $problemas += "há arquivo compactado dentro do pacote: $($compactados -join ', ')"
}
$sujeira = $nomes | Where-Object { $_ -match '(^|/)\.git/|(^|/)store/|\.md$|\.ps1$' }
if ($sujeira) {
  $problemas += "arquivos que não deveriam ir: $($sujeira -join ', ')"
}

if ($problemas.Count -gt 0) {
  Write-Host ""
  Write-Host "PACOTE INVÁLIDO:" -ForegroundColor Red
  $problemas | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
  exit 1
}

$kb = [math]::Round((Get-Item $saida).Length / 1KB, 1)
Write-Host ""
Write-Host "Pacote v$versao validado: $($nomes.Count) itens, $kb KB" -ForegroundColor Green
Write-Host "manifest.json na raiz: sim   |   arquivo compactado dentro: nenhum"
Write-Host ""
Write-Host "SUBA EXATAMENTE ESTE ARQUIVO:" -ForegroundColor Cyan
Write-Host "  $saida" -ForegroundColor Cyan
Write-Host ""
Write-Host "Edge:   https://partner.microsoft.com/dashboard/microsoftedge"
Write-Host "Chrome: https://chrome.google.com/webstore/devconsole"
