param(
    [Parameter(Mandatory=$true,Position=0)][string]$Model,
    [string]$Output,
    [string]$BlenderExe,
    [switch]$NoPhysics
)
# Local, offline conversion. If no executable is provided, fetch a verified
# portable runtime once; nothing is installed system-wide or uploaded.
$ErrorActionPreference='Stop'
$src=Get-Item -LiteralPath $Model
if ($src.Extension -ne '.blend') {throw 'Choose one .blend file.'}
if (!$Output) {$Output=Join-Path $src.DirectoryName ($src.BaseName + '-stage.zip')}
$out=$ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Output)
if ([IO.Path]::GetExtension($out) -ne '.zip' -or (Test-Path -LiteralPath $out)) {throw 'Choose a new .zip output path.'}
if (!$BlenderExe) {
    if ($env:PROCESSOR_ARCHITECTURE -ne 'AMD64') {throw 'Provide -BlenderExe for this architecture.'}
    $cache=Join-Path $env:LOCALAPPDATA 'MmdXrStage\portable';$name='blender-5.1.2-windows-x64'
    $BlenderExe=Join-Path $cache "$name\blender.exe"
    if (!(Test-Path -LiteralPath $BlenderExe)) {
        $null=New-Item -ItemType Directory -Force -Path $cache
        $work=Join-Path $cache ([Guid]::NewGuid().ToString());$null=New-Item -ItemType Directory -Path $work
        try {
            $zip=Join-Path $work 'runtime.zip';$url="https://download.blender.org/release/Blender5.1/$name.zip"
            Write-Host 'Downloading portable Blender (395 MiB, first conversion only)...'
            & curl.exe --fail --location --retry 2 --output $zip $url
            if ($LASTEXITCODE -ne 0) {throw 'Runtime download failed'}
            if ((Get-FileHash -Algorithm SHA256 -LiteralPath $zip).Hash -ne '345bedea7b0acf7cc9666423d8553f9129622aea34ded65c23e8cb70f83f14ff') {throw 'Runtime SHA-256 mismatch'}
            & tar.exe -xf $zip -C $work
            if ($LASTEXITCODE -ne 0) {throw 'Runtime extraction failed'}
            [IO.Directory]::Move((Join-Path $work $name),(Join-Path $cache $name))
        } finally {Remove-Item -LiteralPath $work -Recurse -Force}
    }
}
$runner=(Get-Item -LiteralPath $BlenderExe).FullName
$exporter=Join-Path $PSScriptRoot 'blender_stage\export.py';$opts=@()
if ($NoPhysics) {$opts+='--no-physics'}
& $runner --background --factory-startup --disable-autoexec $src.FullName --python-exit-code 9 --python $exporter -- $out @opts
if ($LASTEXITCODE -ne 0 -or !(Test-Path -LiteralPath $out)) {throw 'Character conversion failed; see Blender output above.'}
Write-Host "Stage package: $out"
