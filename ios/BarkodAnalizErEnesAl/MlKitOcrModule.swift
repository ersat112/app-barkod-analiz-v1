import Foundation
import MLKitTextRecognition
import MLKitVision
import UIKit

@objc(MlKitOcrModule)
class MlKitOcrModule: NSObject {
  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }

  @objc(recognizeTextFromImage:resolver:rejecter:)
  func recognizeTextFromImage(
    _ imageUri: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    let normalizedPath = imageUri.replacingOccurrences(of: "file://", with: "")

    guard let image = UIImage(contentsOfFile: normalizedPath) else {
      reject("OCR_FAILED", "Image could not be loaded for OCR.", nil)
      return
    }

    let visionImage = VisionImage(image: image)
    visionImage.orientation = image.imageOrientation

    let recognizer = TextRecognizer.textRecognizer()

    recognizer.process(visionImage) { result, error in
      if let error = error {
        reject("OCR_FAILED", error.localizedDescription, error)
        return
      }

      guard let result = result else {
        reject("OCR_FAILED", "OCR result was empty.", nil)
        return
      }

      let blocks = result.blocks.compactMap { block in
        block.text.isEmpty ? nil : block.text
      }

      let lines = result.blocks.flatMap { block in
        block.lines.compactMap { line in
          line.text.isEmpty ? nil : line.text
        }
      }

      resolve([
        "text": result.text,
        "blocks": blocks,
        "lines": lines,
        "hasText": !result.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
      ])
    }
  }
}
