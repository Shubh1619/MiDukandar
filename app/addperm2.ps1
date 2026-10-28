$p = 'C:\Users\Shubham\Desktop\abc\MiDukandar\app\android\app\src\main\AndroidManifest.xml'
$s = [IO.File]::ReadAllText($p)
if ($s -notmatch 'READ_SMS') {
  $old = '<uses-permission android:name="android.permission.SEND_SMS"/>'
  $add = "`n    <uses-permission android:name=`"android.permission.READ_SMS`"/>`n    <uses-permission android:name=`"android.permission.RECEIVE_SMS`"/>`n    <uses-permission android:name=`"android.permission.READ_CONTACTS`"/>`n    <uses-permission android:name=`"android.permission.READ_CALL_LOG`"/>"
  $s = $s.Replace($old, $old + $add)
  [IO.File]::WriteAllText($p, $s)
  Write-Host 'done'
} else {
  Write-Host 'has'
}
