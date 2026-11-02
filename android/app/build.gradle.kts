plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.smartshield.womensafety"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.smartshield.womensafety"
        minSdk = 24
        targetSdk = 34
        versionCode = 5
        versionName = "5.0.0"

        // Trusted HTTPS Web App URL deployed from Google AI Studio
        buildConfigField(
            "String",
            "SMART_SHIELD_WEB_URL",
            "\"https://ais-pre-emvmqd2ko5lz7y7x3yyyrr-751605392223.asia-southeast1.run.app\""
        )
    }

    buildTypes {
        debug {
            // Do NOT add applicationIdSuffix = ".debug" so package name remains
            // com.smartshield.womensafety and matches App Settings deep links.
            isMinifyEnabled = false
            isDebuggable = true
        }
        release {
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    buildFeatures {
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("androidx.activity:activity-ktx:1.8.2")
    implementation("androidx.webkit:webkit:1.10.0")
    implementation("com.google.android.material:material:1.11.0")
    implementation("com.google.android.gms:play-services-location:21.2.0")
}
