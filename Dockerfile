FROM denoland/deno:alpine-2.1.4
WORKDIR /app
COPY . .
RUN deno cache main.ts
CMD ["run", "--allow-net", "main.ts"]
