import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { applyPageMetadata, getPageSeo, isProductPath } from "../utils/seo.js";

export default function RouteSeo() {
  const { pathname } = useLocation();
  useEffect(() => {
    // ProductDetailPage owns metadata once the authoritative catalog is available.
    if (!isProductPath(pathname)) applyPageMetadata(document, getPageSeo(pathname));
  }, [pathname]);
  return null;
}
