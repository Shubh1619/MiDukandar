const fs=require('fs');
const p='C:/Users/Shubham/Desktop/abc/MiDukandar/app/android/app/src/main/AndroidManifest.xml';
let s=fs.readFileSync(p,'utf8');
const t='<uses-permission android:name="android.permission.SEND_SMS"/>';
const add='\n    <uses-permission android:name="android.permission.READ_SMS"/>\n    <uses-permission android:name="android.permission.RECEIVE_SMS"/>\n    <uses-permission android:name="android.permission.READ_CONTACTS"/>\n    <uses-permission android:name="android.permission.READ_CALL_LOG"/>';
if(s.indexOf(t)>=0 && s.indexOf('READ_SMS')<0){
  s=s.split(t).join(t+add);
  fs.writeFileSync(p,s);
  console.log('ok');
}else{console.log('skip');}
