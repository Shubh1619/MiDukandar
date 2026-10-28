p='C:/Users/Shubham/Desktop/abc/MiDukandar/app/android/app/src/main/AndroidManifest.xml'
s=open(p).read()
old='    <uses-permission android:name="android.permission.SEND_SMS"/>\n    <uses-permission android:name="android.permission.READ_PHONE_STATE"/>'
new='    <uses-permission android:name="android.permission.SEND_SMS"/>\n    <uses-permission android:name="android.permission.READ_SMS"/>\n    <uses-permission android:name="android.permission.RECEIVE_SMS"/>\n    <uses-permission android:name="android.permission.READ_CONTACTS"/>\n    <uses-permission android:name="android.permission.READ_CALL_LOG"/>\n    <uses-permission android:name="android.permission.READ_PHONE_STATE"/>'
if old in s:
    open(p,'w').write(s.replace(old,new))
    print('ok')
else:
    print('no')
