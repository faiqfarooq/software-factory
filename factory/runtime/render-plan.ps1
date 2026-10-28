param([Parameter(Mandatory=$true)][ValidatePattern('^[A-Za-z0-9_-]{1,80}$')][string]$ArtifactId)
$ErrorActionPreference='Stop'
$root=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../..')).Path
$base=[IO.Path]::GetFullPath((Join-Path $root 'factory/.local/plan-artifacts'))
$folder=[IO.Path]::GetFullPath((Join-Path $base $ArtifactId))
if(-not $folder.StartsWith($base+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Invalid artifact directory.'}
$docxPath=Join-Path $folder 'plan.docx';$pdfPath=Join-Path $folder 'plan.pdf'
$wordApp=$null;$wordDoc=$null
try{
 $wordApp=New-Object -ComObject Word.Application
 $wordApp.Visible=$false;$wordApp.DisplayAlerts=0;$wordApp.AutomationSecurity=3
 $wordVersion=$wordApp.Version
 $wordDoc=$wordApp.Documents.Open($docxPath,$false,$true,$false)
 $wordDoc.Repaginate();$wordPages=$wordDoc.ComputeStatistics(2)
 $wordDoc.ExportAsFixedFormat($pdfPath,17,$false)
 $wordDoc.Close(0);$wordDoc=$null
}finally{
 if($null -ne $wordDoc){try{$wordDoc.Close(0)}catch{}}
 if($null -ne $wordApp){try{$noSave=0;$wordApp.Quit([ref]$noSave)}catch{}}
 foreach($object in @($wordDoc,$wordApp)){if($null -ne $object -and [Runtime.InteropServices.Marshal]::IsComObject($object)){[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($object)}}
 [GC]::Collect();[GC]::WaitForPendingFinalizers()
}
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null=[Windows.Storage.StorageFile,Windows.Storage,ContentType=WindowsRuntime]
$null=[Windows.Data.Pdf.PdfDocument,Windows.Data.Pdf,ContentType=WindowsRuntime]
$null=[Windows.Data.Pdf.PdfPageRenderOptions,Windows.Data.Pdf,ContentType=WindowsRuntime]
$null=[Windows.Storage.Streams.InMemoryRandomAccessStream,Windows.Storage.Streams,ContentType=WindowsRuntime]
$null=[Windows.Storage.Streams.DataReader,Windows.Storage.Streams,ContentType=WindowsRuntime]
$adapter=[System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {$_.Name -eq 'AsTask' -and $_.IsGenericMethodDefinition -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'} | Select-Object -First 1
$action=[System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {$_.Name -eq 'AsTask' -and -not $_.IsGenericMethodDefinition -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncAction'} | Select-Object -First 1
function Wait-Result($operation,[Type]$resultType){return $adapter.MakeGenericMethod($resultType).Invoke($null,@($operation)).GetAwaiter().GetResult()}
$file=Wait-Result ([Windows.Storage.StorageFile]::GetFileFromPathAsync($pdfPath)) ([Windows.Storage.StorageFile])
$pdf=Wait-Result ([Windows.Data.Pdf.PdfDocument]::LoadFromFileAsync($file)) ([Windows.Data.Pdf.PdfDocument])
if($pdf.PageCount -ne $wordPages){throw 'Word/PDF page count mismatch.'}
$pages=@()
for($index=0;$index -lt $pdf.PageCount;$index++){
 $page=$pdf.GetPage([uint32]$index);$stream=New-Object Windows.Storage.Streams.InMemoryRandomAccessStream;$reader=$null
 try{
  $options=New-Object Windows.Data.Pdf.PdfPageRenderOptions;$options.DestinationWidth=[uint32]1632
  $action.Invoke($null,@($page.RenderToStreamAsync($stream,$options))).GetAwaiter().GetResult()
  $stream.Seek(0);$reader=New-Object Windows.Storage.Streams.DataReader($stream.GetInputStreamAt(0))
  $loaded=Wait-Result ($reader.LoadAsync([uint32]$stream.Size)) ([uint32])
  if($loaded -ne $stream.Size){throw 'Incomplete page render.'}
  $bytes=New-Object byte[] ([int]$stream.Size);$reader.ReadBytes($bytes)
  $image=Join-Path $folder ('page-'+($index+1)+'.png');[IO.File]::WriteAllBytes($image,$bytes)
  $pages+=@{page=$index+1;file='page-'+($index+1)+'.png';bytes=$bytes.Length}
 }finally{if($null -ne $reader){$reader.Dispose()};$stream.Dispose();$page.Dispose()}
}
$result=@{status='rendered-awaiting-review';pages=$pages;wordVersion=$wordVersion;sha256=(Get-FileHash -LiteralPath $docxPath -Algorithm SHA256).Hash.ToLowerInvariant();method='Microsoft Word export and Windows PDF page rasterization'}
$result | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $folder 'render.json') -Encoding UTF8
$result | ConvertTo-Json -Depth 5 -Compress
