"use client";

import { useEffect, useMemo, useState } from "react";
import FontFreeIcon, { type FontFreeIconName } from "@/components/ui/FontFreeIcon";

type ClubShopProduct = {
  productNo: number;
  name: string;
  price: number;
  image: string;
  url: string;
  purchasable: boolean;
  state: string;
};

type ClubShopResponse = {
  success?: boolean;
  club?: string;
  label?: string;
  count?: number;
  products?: ClubShopProduct[];
  source?: string;
  fetchedAt?: string;
  error?: string;
  missingEnv?: string[];
};

type ShopLoadState = {
  status: "loading" | "ready" | "unavailable";
  statusCode: number | null;
  data: ClubShopResponse | null;
};

function formatPrice(price: number) {
  return `${price.toLocaleString("ko-KR")}원`;
}

function shopMessage(state: ShopLoadState): { icon: FontFreeIconName; title: string; body: string } {
  const error = state.data?.error || "";
  const missingEnv = Boolean(state.data?.missingEnv?.length);

  if (state.statusCode === 503 || missingEnv) {
    return {
      icon: "auto_fix_high",
      title: "클럽샵 준비 중입니다",
      body: "본사에서 다산점 진열대를 연결하면 상품이 자동으로 표시됩니다.",
    };
  }

  if (state.statusCode === 400 || state.statusCode === 404 || error.includes("상품을 찾을 수 없습니다")) {
    return {
      icon: "image",
      title: "클럽샵 상품을 준비 중입니다",
      body: "현재 다산점에 노출할 상품을 본사에서 확인하고 있습니다. 준비되면 이 화면에 바로 나타납니다.",
    };
  }

  return {
    icon: "error",
    title: "잠시 후 다시 시도해 주세요",
    body: "상품 정보를 불러오는 중 문제가 생겼습니다. 결제나 주문은 실행되지 않았습니다.",
  };
}

export default function ClubShopClient() {
  const [state, setState] = useState<ShopLoadState>({
    status: "loading",
    statusCode: null,
    data: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadProducts() {
      setState({ status: "loading", statusCode: null, data: null });
      try {
        const response = await fetch("/api/products/club-shop", {
          headers: { Accept: "application/json" },
        });
        const data = await response.json().catch(() => ({
          success: false,
          error: "상품 정보 형식이 올바르지 않습니다.",
        })) as ClubShopResponse;
        const products = Array.isArray(data.products) ? data.products : [];

        if (!cancelled) {
          setState({
            status: response.ok && data.success === true && products.length > 0 ? "ready" : "unavailable",
            statusCode: response.status,
            data: { ...data, products },
          });
        }
      } catch {
        if (!cancelled) {
          setState({
            status: "unavailable",
            statusCode: null,
            data: { success: false, error: "클럽샵 상품 정보를 불러오지 못했습니다.", products: [] },
          });
        }
      }
    }

    loadProducts();
    return () => {
      cancelled = true;
    };
  }, []);

  const products = useMemo(() => state.data?.products ?? [], [state.data?.products]);

  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-lg dark:bg-gray-800">
      <div className="grid gap-0 border-b border-gray-100 bg-gray-950 text-white dark:border-gray-700 md:grid-cols-[1.05fr_0.95fr]">
        <div className="px-6 py-7 md:px-8">
          <p className="mb-2 text-xs font-black uppercase tracking-widest text-brand-orange-400 dark:text-brand-neon-lime">
            SHOP
          </p>
          <h2 className="break-keep text-2xl font-black md:text-3xl">스티즈 클럽샵</h2>
          <p className="mt-3 max-w-xl break-keep text-sm leading-6 text-gray-300">
            농구공, 훈련 용품, 키즈 제품을 보고 카페24 본사 쇼핑몰에서 바로 결제합니다.
            상품 가격과 구매 링크는 본사 진열대 기준 그대로 표시됩니다.
          </p>
        </div>
        <div className="relative min-h-56 overflow-hidden bg-[radial-gradient(circle_at_20%_20%,rgba(204,255,0,0.26),transparent_30%),linear-gradient(135deg,#111827,#020617)] px-6 py-7">
          <div className="absolute right-5 top-5 rounded-full border border-white/15 px-3 py-1 text-xs font-black text-white/80">
            카페24 결제
          </div>
          <div className="flex h-full items-end">
            <div className="w-full rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-gray-300">구매 방식</p>
                  <p className="mt-1 text-lg font-black">상품 하나씩 바로 이동</p>
                </div>
                <FontFreeIcon name="open_in_new" size={32} className="text-brand-neon-lime" />
              </div>
              <p className="mt-3 text-xs leading-5 text-gray-300">
                학원 화면은 그대로 남고, 결제는 새 창에서 진행됩니다.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-5 md:p-6">
        {state.status === "loading" && <ShopSkeleton />}

        {state.status === "unavailable" && (
          <ShopNotice {...shopMessage(state)} onRetry={() => window.location.reload()} />
        )}

        {state.status === "ready" && (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm font-black text-gray-900 dark:text-white">
                  {state.data?.label || "스티즈농구교실 다산점"} 추천 상품
                </p>
                <p className="mt-1 text-xs font-bold text-gray-500 dark:text-gray-400">
                  가격과 판매 상태는 본사 쇼핑몰 기준입니다.
                </p>
              </div>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-black text-gray-600 dark:bg-gray-900 dark:text-gray-300">
                {products.length}개 상품
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => (
                <ProductCard key={product.productNo} product={product} />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function ProductCard({ product }: { product: ClubShopProduct }) {
  const disabled = !product.purchasable || !product.url;
  const stateLabel = product.state.trim();

  return (
    <article className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-gray-700 dark:bg-gray-900">
      <ProductImage src={product.image} name={product.name} />
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="break-keep text-base font-black text-gray-950 dark:text-white">{product.name}</h3>
            <p className="mt-1 text-xs font-bold text-gray-500 dark:text-gray-400">상품번호 {product.productNo}</p>
          </div>
          {stateLabel && (
            <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-black text-gray-600 dark:bg-gray-800 dark:text-gray-300">
              {stateLabel}
            </span>
          )}
        </div>

        <p className="text-xl font-black text-gray-950 dark:text-white">{formatPrice(product.price)}</p>

        {disabled ? (
          <span className="flex min-h-11 items-center justify-center rounded-xl bg-gray-100 text-sm font-black text-gray-400 dark:bg-gray-800 dark:text-gray-500">
            구매 불가
          </span>
        ) : (
          <a
            href={product.url}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-orange-500 text-sm font-black text-white transition hover:bg-brand-orange-600 dark:bg-brand-neon-lime dark:text-brand-navy-900 dark:hover:bg-lime-400"
          >
            구매하러 가기
            <FontFreeIcon name="open_in_new" size={18} />
          </a>
        )}
      </div>
    </article>
  );
}

function ProductImage({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState(!src);

  return (
    <div className="relative aspect-[4/3] overflow-hidden bg-gray-100 dark:bg-gray-950">
      {!failed && (
        <img
          src={src}
          alt={name}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      )}
      {failed && (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[linear-gradient(135deg,#111827,#f97316)] p-5 text-center text-white dark:bg-[linear-gradient(135deg,#020617,#1e3a8a)]">
          <img src="/stiz-logo.png" alt="" className="h-12 w-auto rounded bg-white p-2" />
          <p className="break-keep text-sm font-black">상품 이미지 준비 중</p>
        </div>
      )}
    </div>
  );
}

function ShopSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map((item) => (
        <div key={item} className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <div className="aspect-[4/3] animate-pulse bg-gray-100 dark:bg-gray-800" />
          <div className="space-y-3 p-4">
            <div className="h-4 w-3/4 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
            <div className="h-6 w-1/2 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
            <div className="h-11 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ShopNotice({
  icon,
  title,
  body,
  onRetry,
}: {
  icon: FontFreeIconName;
  title: string;
  body: string;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-5 py-8 text-center dark:border-gray-700 dark:bg-gray-900">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-brand-orange-500 shadow-sm dark:bg-gray-800 dark:text-brand-neon-lime">
        <FontFreeIcon name={icon} size={28} />
      </div>
      <h3 className="mt-4 break-keep text-xl font-black text-gray-950 dark:text-white">{title}</h3>
      <p className="mx-auto mt-2 max-w-md break-keep text-sm leading-6 text-gray-600 dark:text-gray-300">{body}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-black text-gray-700 transition hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-950"
      >
        <FontFreeIcon name="sync" size={18} />
        다시 확인
      </button>
    </div>
  );
}
