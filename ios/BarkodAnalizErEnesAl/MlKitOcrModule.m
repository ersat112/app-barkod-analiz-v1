#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(MlKitOcrModule, NSObject)

RCT_EXTERN_METHOD(
  recognizeTextFromImage:(NSString *)imageUri
  resolver:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

@end
