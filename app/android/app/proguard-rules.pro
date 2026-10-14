# R8/ProGuard rules for release builds.
#
# Enabled from android/app/build.gradle.kts via:
#   isMinifyEnabled / isShrinkResources + proguardFiles(...)
#
# Scope is deliberately narrow: the Flutter Gradle plugin already contributes
# consumer rules for the embedding, so we only need to cover the pieces that are
# resolved reflectively at runtime and would otherwise be stripped or renamed.

# --- Flutter embedding / plugin registration -------------------------------
# PluginRegistrant and generated plugin classes are looked up by name.
-keep class io.flutter.embedding.engine.plugins.** { *; }
-keep class io.flutter.plugins.** { *; }
-keep class io.flutter.plugin.** { *; }
-dontwarn io.flutter.embedding.**

# --- flutter_secure_storage -------------------------------------------------
# EncryptedSharedPreferences resolves crypto providers reflectively.
-keep class androidx.security.crypto.** { *; }
-keep class com.it_nomads.fluttersecurestorage.** { *; }
-dontwarn com.it_nomads.fluttersecurestorage.**

# --- Annotations & generic signatures --------------------------------------
# Preserve annotations and generic type info for reflective framework lookups.
-keepattributes *Annotation*, Signature, InnerClasses, EnclosingMethod

# --- Diagnostics -----------------------------------------------------------
# Keep line numbers so release crash reports stay readable, while hiding the
# original source file name.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
