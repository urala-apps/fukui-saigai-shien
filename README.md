# fukui-saigai-shien — お問い合わせチャット

外部のサイトに **1行貼るだけ** で動く、お問い合わせチャットです。
最初のお客さんは「福井県大雨被災事業者再建支援補助金」の運営事務局です。

```html
<script src="https://urala-apps.github.io/fukui-saigai-shien/w.js" data-id="saigai" async></script>
```

お客さんが触るのはこの1行だけです。答えの中身・色・問い合わせ先は、このリポジトリの設定を直せば反映されます。

## 仕組み

```
お客さんのサイト ──1行──▶ w.js（GitHub Pages から配る）
                              │ bots/<id>.json を読む
                              ├─ api が空 → FAQ から近い答えを選ぶ（費用0円）
                              └─ api あり → Edge Function → Claude（資料の中だけで答える）
```

| ファイル | 中身 |
|---|---|
| `w.js` | 小窓の本体。Shadow DOM の中に作るので、お客さんのサイトの CSS とぶつからない |
| `bots/<id>.json` | お客さんごとの設定（名前・色・あいさつ・問い合わせ先・FAQ・置いてよいドメイン・月の上限） |
| `bots/<id>.*.txt` | AI に読ませる資料（`knowledge` に書いたもの） |
| `supabase/functions/chat/` | AI で答える Edge Function（Claude Haiku 5.5） |
| `supabase/migrations/` | お客さんごとの月の回数を数える表 |
| `index.html` | 見本のページ（右下に小窓が出る） |

## 書き方の決まり

- 答えは **資料（公募要領など）にある事実だけ**。FAQ には出典（例：公募要領 P.5）を付ける
- 個別の案件が対象になるかの判断はしない。窓口（電話・メール）へ案内する
- 小窓には「自動の案内で、最終的な判断は審査による」旨を出す（`notice`）

## お客さんを足す

1. `bots/<新しい id>.json` を作る（`bots/saigai.json` をまねる）
2. `allowed_origins` に、置くサイトの URL（`https://〜` まで）を書く
3. お客さんに1行を渡す（`data-id` を新しい id に）

## AI で答えるようにする

1. Supabase に `supabase/migrations/` を当て、`supabase/functions/chat` をデプロイする
2. Edge Function の環境変数：`ANTHROPIC_API_KEY`、`BOTS_BASE`（w.js の配信元。`https://urala-apps.github.io/fukui-saigai-shien/`）
3. `bots/<id>.json` の `api` に Edge Function の URL を書く

AI がつながらないとき・月の上限を超えたときは、自動で FAQ の答えに切り替わります。
API の鍵はリポジトリに書かないこと。

## 手元で見る

```sh
python3 -m http.server 8000   # http://localhost:8000/ を開く
```
