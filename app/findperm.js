const fs=require('fs');
const p='C:/Users/Shubham/Desktop/abc/MiDukandar/app/android/app/src/main/AndroidManifest.xml';
const s=fs.readFileSync(p,'utf8');
const re=/<uses-permission[^>]+>/g;
let m;
while((m=re.exec(s))) { console.log(m[0]); }
