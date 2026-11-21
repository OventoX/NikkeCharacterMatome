# NIKKE キャラまとめ表

『勝利の女神：NIKKE』のプレイアブルキャラクター（SSR / SR / R）を一覧・検索・閲覧できる個人用静的データベースサイトです（キャラ閲覧専用・攻略情報なし）。

## 収録データ件数（2026-11-22 時点）

- **総数**：**210 体**
  - **SSR**：179 体
  - **SR**：20 体
  - **R**：11 体
- **収録画像総数**：**398 枚**（通常姿＋コスチューム外部URL参照）

### 名簿の突合と除外について

Game8 のレアリティ別キャラ一覧（SSR: 179 / SR: 20 / R: 11、計 210 体）を正本とし、Fandom 版 NIKKE Wiki の `Category:Playable_characters`（212 ページ）と 1 対 1 で突合しました。Game8 のプレイアブル名簿に含まれない以下 2 件は除外しています。

- `Marian`（SR・チュートリアル専用の一時プレイアブルキャラ）
- `Mekami Shifty`（R・エイプリルフール期間限定プレイアブルキャラ）

## 主な機能

- カード一覧表示（通常姿サムネイル、名前、レアリティ、企業、武器種、バースト段階）
- テキスト検索（日本語名 / 英語名 / 部隊名 / ID）
- AND 条件フィルタ（レアリティ / 企業 / 武器種 / バースト段階 / 属性 / クラス / お気に入りのみ）
- ソート（レアリティ順 / 名前順 / ID 昇順）
- 詳細モーダル（基本情報、スキル一覧、画像ギャラリー）
- 画像ライトボックス（拡大表示、`←`/`→` キーで前後キャラ移動、`↑`/`↓` キーで同一キャラ内の画像切替、ピンチズーム 1〜4 倍、ダブルタップ切替）
- お気に入り機能（`localStorage` 保存）
- PWA / オフライン対応（Service Worker `nikke-matome-v1`、Network-first 戦略）

## 出典

- [Game8『勝利の女神：NIKKE』キャラ一覧（SSR / SR / R）](https://game8.jp/nikke/491924)
- [Goddess of Victory: Nikke Wiki (Fandom) - Category:Playable_characters](https://nikke-goddess-of-victory-international.fandom.com/wiki/Category:Playable_characters)

※ 画像ファイルはリポジトリに含めず、Fandom Wiki の外部 URL を参照しています。

## データ更新・検証手順

Python 3 と Node.js が必要です。

```bash
# 1. 出典からデータを再取得して app/data.js を生成（キャッシュ利用）
python tools/build_data.py

#    キャッシュを無視して最新ページを再取得する場合
python tools/build_data.py --refresh

# 2. データ整合性検証
node tools/verify_all.js

# 3. JavaScript 構文チェック
node --check app/data.js
node --check app/app.js
node --check app/sw.js
node --check tools/verify_all.js
```

## 公開方法

ルート直下の `index.html` から `app/` へリダイレクトする相対パス構成のため、そのまま GitHub Pages で公開できます。
