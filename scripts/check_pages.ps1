param(
    [string]$DocPath = "D:\BaoCao\NguyenLyHQLCSDL\principles-of-database-project\Báo cáo NLHQT.docx",
    [switch]$ExportPdf
)
try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $doc = $word.Documents.Open($DocPath)
    $pages = $doc.ComputeStatistics(2)
    $words = $doc.ComputeStatistics(0)
    
    if ($ExportPdf) {
        $pdfPath = [System.IO.Path]::ChangeExtension($DocPath, ".pdf")
        $doc.SaveAs([ref]$pdfPath, [ref]17) # 17 = wdFormatPDF
        Write-Host "PDF_EXPORT: $pdfPath"
    }

    $doc.Close()
    $word.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
    Write-Host "WORD_STATS: File = $DocPath, Pages = $pages, Words = $words"
} catch {
    Write-Host "Error: $($_.Exception.Message)"
}
