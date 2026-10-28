var fs=require('fs');
var p='C:/Users/Shubham/Desktop/abc/MiDukandar/app/android/app/src/main/AndroidManifest.xml';
var s=fs.readFileSync(p,'utf8');
var o='<uses-permission android:name="android.permission.SEND_SMS"/>';
var n='<uses-permission android:name="android.permission.SEND_SMS"/>\n    <uses-permission android:name="android.permission.READ_SMS"/>\n    <uses-permission android:name="android.permission.RECEIVE_SMS"/>\n    <uses-permission android:name="android.permission.READ_CONTACTS"/>\n    <uses-permission android:name="android.permission.READ_CALL_LOG"/>';
if(s.indexOf('READ_SMS')==-1 && s.indexOf(o)>=0){
  s=s.split(o).join(n);
  fs.writeFileSync(p,s);
}
