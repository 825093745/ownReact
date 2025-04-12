如果出现 Error: error:0308010C:digital envelope routines::unsupported 这样的错误
macOS将start命令改为  "start": "export NODE_OPTIONS=--openssl-legacy-provider && react-scripts start",
windows将start命令改为 "start": "set NODE_OPTIONS=--openssl-legacy-provider && react-scripts start"
