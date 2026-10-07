Add-Type -AssemblyName System.Drawing

$assetDirectory = Join-Path $PSScriptRoot '..\assets'
$assetDirectory = [System.IO.Path]::GetFullPath($assetDirectory)

foreach ($size in @(180, 192, 512)) {
    $bitmap = New-Object System.Drawing.Bitmap($size, $size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $green = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(17, 185, 119))
    $white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $greenPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(17, 185, 119), [single]($size * .055))
    $whitePen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, [single]($size * .055))
    $greenPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $greenPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $whitePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $whitePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

    $graphics.Clear([System.Drawing.Color]::White)
    $graphics.FillRectangle($green, 0, 0, $size, $size)
    $graphics.FillRectangle($white, [single]($size * .25), [single]($size * .27), [single]($size * .5), [single]($size * .48))
    $graphics.DrawLine($greenPen, [single]($size * .25), [single]($size * .4), [single]($size * .75), [single]($size * .4))
    $graphics.DrawLine($whitePen, [single]($size * .36), [single]($size * .2), [single]($size * .36), [single]($size * .34))
    $graphics.DrawLine($whitePen, [single]($size * .64), [single]($size * .2), [single]($size * .64), [single]($size * .34))
    $points = [System.Drawing.PointF[]]@(
        [System.Drawing.PointF]::new([single]($size * .37), [single]($size * .55)),
        [System.Drawing.PointF]::new([single]($size * .46), [single]($size * .64)),
        [System.Drawing.PointF]::new([single]($size * .65), [single]($size * .47))
    )
    $graphics.DrawLines($greenPen, $points)

    $name = if ($size -eq 180) { 'apple-touch-icon.png' } else { "icon-$size.png" }
    $bitmap.Save((Join-Path $assetDirectory $name), [System.Drawing.Imaging.ImageFormat]::Png)
    $graphics.Dispose()
    $bitmap.Dispose()
    $green.Dispose()
    $white.Dispose()
    $greenPen.Dispose()
    $whitePen.Dispose()
}
