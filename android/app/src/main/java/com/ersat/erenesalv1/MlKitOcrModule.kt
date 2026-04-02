package com.ersat.erenesalv1

import android.net.Uri
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions

class MlKitOcrModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "MlKitOcrModule"

  @ReactMethod
  fun recognizeTextFromImage(imageUri: String, promise: Promise) {
    try {
      val context = reactApplicationContext
      val uri = Uri.parse(imageUri)
      val image = InputImage.fromFilePath(context, uri)
      val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)

      recognizer
        .process(image)
        .addOnSuccessListener { result ->
          val payload = Arguments.createMap()
          val blocks = Arguments.createArray()
          val lines = Arguments.createArray()

          result.textBlocks.forEach { block ->
            if (block.text.isNotBlank()) {
              blocks.pushString(block.text)
            }

            block.lines.forEach { line ->
              if (line.text.isNotBlank()) {
                lines.pushString(line.text)
              }
            }
          }

          payload.putString("text", result.text)
          payload.putArray("blocks", blocks)
          payload.putArray("lines", lines)
          payload.putBoolean("hasText", result.text.isNotBlank())

          promise.resolve(payload)
          recognizer.close()
        }
        .addOnFailureListener { error ->
          recognizer.close()
          promise.reject("OCR_FAILED", error.message, error)
        }
    } catch (error: Exception) {
      promise.reject("OCR_FAILED", error.message, error)
    }
  }
}
