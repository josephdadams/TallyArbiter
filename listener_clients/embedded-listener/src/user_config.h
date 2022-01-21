#ifndef _USER_CONFIG_H_
#define _USER_CONFIG_H_

//If you want to load custom build config, uncomment the following line and edit the file user_config_override.h
//#define USE_CONFIG_OVERRIDE true

#define USE_STATIC_IP false

#ifdef USE_CONFIG_OVERRIDE
  #include "user_config_override.h"         // Configuration overrides for my_user_config.h
#endif

#endif