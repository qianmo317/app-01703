# 3D抽奖系统 Dockerfile
# 支持 ARM64 和 AMD64 架构

FROM --platform=$TARGETPLATFORM nginx:1.25-alpine

# 设置工作目录
WORKDIR /usr/share/nginx/html

# 删除默认nginx页面
RUN rm -rf /usr/share/nginx/html/*

# 复制静态文件
COPY index.html .
COPY css/ ./css/
COPY js/ ./js/
COPY assets/ ./assets/

# 复制nginx配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 暴露端口
EXPOSE 80

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

# 启动nginx
CMD ["nginx", "-g", "daemon off;"]
