const fs = require('fs');
const p = 'C:/Users/Shubham/Desktop/abc/MiDukandar/app/android/app/src/main/AndroidManifest.xml';
let s = fs.readFileSync(p, 'utf8');
if (s.indexOf('READ_SMS') === -1) {
  const old = '<uses-permission android:name="android.permission.SEND_SMS"/>';
  const add = '\n    <uses-permission android:name="android.permission.READ_SMS"/>\n    <uses-permission android:name="android.permission.RECEIVE_SMS"/>\n    <uses-permission android:name="android.permission.READ_CONTACTS"/>\n    <uses-permission android:name="android.permission.READ_CALL_LOG"/>';
  if (s.indexOf(old) >= 0) {
    s = s.split(old).join(old + add);
    fs.writeFileSync(p, s);
  }
}
console.log(s.indexOf('READ_SMS'));
