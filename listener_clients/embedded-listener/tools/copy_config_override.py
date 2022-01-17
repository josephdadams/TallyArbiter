Import('env')
import os
import shutil

if os.path.isfile("src/user_config_override.h"):
    print ("*** use provided user_config_override.h as planned ***")
else: 
    shutil.copy("src/user_config_override_sample.h", "src/user_config_override.h")
