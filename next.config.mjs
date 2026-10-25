/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 构建时不跑 ESLint（避免交互式 prompt）；类型检查仍保留。
  eslint: { ignoreDuringBuilds: true },
  // 外部图源（采集器写入 D1 的 image_url 可能来自这些域名）。
  // 站点内部使用原生 <img> + onError 回退，故不强制 next/image 域名白名单；
  // 若改用 next/image，请在此补充 remotePatterns。
};

export default nextConfig;
