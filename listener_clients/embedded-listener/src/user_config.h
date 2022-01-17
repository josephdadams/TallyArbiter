#ifndef _USER_CONFIG_H_
#define _USER_CONFIG_H_

//#define USE_CONFIG_OVERRIDE

#define USE_STATIC_IP false

#ifdef USE_CONFIG_OVERRIDE
  #include "user_config_override.h"         // Configuration overrides for my_user_config.h
#endif

#endif