const fs=require('fs');
const p='C:/Users/Shubham/Desktop/abc/MiDukandar/app/android/app/src/main/AndroidManifest.xml';
const s=fs.readFileSync(p,'utf8');
const old='<uses-permission android:name="android.permission.SEND_SMS"/>\n    <uses-permission android:name="android.permission.READ_PHONE_STATE"/>';
const neu='<uses-permission android:name="android.permission.SEND_SMS"/>\n    <uses-permission android:name="android.permission.READ_SMS"/>\n    <uses-permission android:name="android.permission.RECEIVE_SMS"/>\n    <uses-permission android:name="android.permission.READ_CONTACTS"/>\n    <uses-permission android:name="android.permission.READ_CALL_LOG"/>\n    <uses-permission android:name="android.permission.READ_PHONE_STATE"/>';
if(s.includes(old)){fs.writeFileSync(p,s.replace(old,neu));console.log('ok');}else{console.log('no');}
