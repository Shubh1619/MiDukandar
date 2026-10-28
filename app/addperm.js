const fs=require('fs');
const p='C:/Users/Shubham/Desktop/abc/MiDukandar/app/android/app/src/main/AndroidManifest.xml';
let s=fs.readFileSync(p,'utf8');
if(s.indexOf('READ_SMS')===-1){
  const o='<uses-permission android:name="android.permission.SEND_SMS"/>';
  const n='<uses-permission android:name="android.permission.SEND_SMS"/>\n    <uses-permission android:name="android.permission.READ_SMS"/>\n    <uses-permission android:name="android.permission.RECEIVE_SMS"/>\n    <uses-permission android:name="android.permission.READ_CONTACTS"/>\n    <uses-permission android:name="android.permission.READ_CALL_LOG"/>';
  if(s.indexOf(o)>=0){s=s.split(o).join(n);fs.writeFileSync(p,s);console.log('ok');}else{console.log('no');}
}else{console.log('ex');}
