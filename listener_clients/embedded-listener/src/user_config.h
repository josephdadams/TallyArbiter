#ifndef _USER_CONFIG_H_
#define _USER_CONFIG_H_

#define USE_STATIC_IP false

#define M5STICKC_BRIGHTNESS 11

#define TTGO_SCREEN_ROTATION 1
#define TTGO_SWAP_BYTES true
#define TTGO_ADC_EN  14 //ADC detection enable port
#define TTGO_ADC_PIN 34
#define TTGO_TFT_DISPOFF 0x28
#define TTGO_TFT_SLPIN   0x10
#define TTGO_ENABLE_BATTERY_INDICATOR true
#define TTGO_BATTERY_INDICATOR_COLOR 0xFFFF
#define TTGO_BATTERY_LOW_INDICATOR_COLOR 0xFF00

#include "user_config_override.h"         // Configuration overrides for user_config.h

#endif