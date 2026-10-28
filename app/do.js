const fs=require('fs');
const p='C:/Users/Shubham/Desktop/abc/MiDukandar/app/android/app/src/main/AndroidManifest.xml';
let s=fs.readFileSync(p,'utf8');
if(s.indexOf('READ_SMS')===-1){
  s=s.replace('<uses-permission android:name="android.permission.SEND_SMS"/>','<uses-permission android:name="android.permission.SEND_SMS"/>\n    <uses-permission android:name="android.permission.READ_SMS"/>\n    <uses-permission android:name="android.permission.RECEIVE_SMS"/>\n    <uses-permission android:name="android.permission.READ_CONTACTS"/>\n    <uses-permission android:name="android.permission.READ_CALL_LOG"/>');
  fs.writeFileSync(p,s);
}
