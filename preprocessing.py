import pandas as pd
import numpy as np
import json
import os


DATA_DIR = "data"
SEP = "─" * 58

def section(title):
    print(f"\n{SEP}\n  {title}\n{SEP}")

def report(df, label):
    missing = df.isnull().sum()
    missing = missing[missing > 0]
    print(f"\n  [{label}]  shape={df.shape}")
    if len(missing):
        print(f"  Missing:\n{missing.to_string()}")
    else:
        print("  Missing  : tidak ada")
    print(f"  Duplikat : {df.duplicated().sum()} baris")

section("1. LOAD RAW DATA")

tourism = pd.read_csv(f"{DATA_DIR}/tourism_with_id.csv")
rating  = pd.read_csv(f"{DATA_DIR}/tourism_rating.csv")
package = pd.read_csv(f"{DATA_DIR}/package_tourism.csv")
user    = pd.read_csv(f"{DATA_DIR}/user.csv")

for df, name in [(tourism,"tourism_with_id"), (rating,"tourism_rating"),
                 (package,"package_tourism"), (user,"user")]:
    report(df, name)


section("2. PREPROCESSING — tourism_with_id.csv")

tourism_clean = tourism.drop(columns=["Unnamed: 11", "Unnamed: 12", "Coordinate"])
print("  ✓ Drop kolom : Unnamed: 11, Unnamed: 12, Coordinate")

tourism_clean["Time_Minutes"] = tourism_clean.groupby("Category")["Time_Minutes"] \
    .transform(lambda x: x.fillna(x.median()))
n_sisa = tourism_clean["Time_Minutes"].isna().sum()
print(f"  ✓ Imputasi Time_Minutes (median per Category)  → sisa NaN: {n_sisa}")

tourism_clean["Lat"]   = pd.to_numeric(tourism_clean["Lat"],   errors="coerce")
tourism_clean["Long"]  = pd.to_numeric(tourism_clean["Long"],  errors="coerce")
tourism_clean["Price"] = pd.to_numeric(tourism_clean["Price"], errors="coerce")
print("  ✓ Konversi tipe: Lat, Long, Price → numeric")

bins_p   = [-1, 0, 50_000, 150_000, float("inf")]
labels_p = ["Gratis", "Murah", "Menengah", "Mahal"]
tourism_clean["Price_Category"] = pd.cut(
    tourism_clean["Price"], bins=bins_p, labels=labels_p
)
print("  ✓ Tambah kolom Price_Category")

report(tourism_clean, "tourism_with_id BERSIH")


section("3. PREPROCESSING — tourism_rating.csv")

before = len(rating)
rating_clean = rating.drop_duplicates()
print(f"  ✓ Drop duplikat : {before - len(rating_clean)} baris  ({before} → {len(rating_clean)})")

rating_clean = rating_clean[rating_clean["Place_Ratings"].between(1, 5)]
print("  ✓ Validasi range rating 1–5")

rating_agg = rating_clean.groupby("Place_Id").agg(
    Avg_Rating   = ("Place_Ratings", "mean"),
    Rating_Count = ("Place_Ratings", "count")
).reset_index().round({"Avg_Rating": 2})
print(f"  ✓ Agregasi → {len(rating_agg)} Place_Id unik")

report(rating_clean, "tourism_rating BERSIH")


section("4. PREPROCESSING — package_tourism.csv")

package_clean = package.copy()
place_cols = [f"Place_Tourism{i}" for i in range(1, 6)]
package_clean["Total_Places"] = package_clean[place_cols].notna().sum(axis=1)
print("  ✓ Tambah kolom Total_Places")
print("  ✓ NaN Place_Tourism4/5 dibiarkan (valid — paket bervariasi)")

report(package_clean, "package_tourism BERSIH")

section("5. PREPROCESSING — user.csv  (geocoding)")

LOCATION_COORDS = {
    "Semarang, Jawa Tengah"         : (-7.0051,  110.4381),
    "Bekasi, Jawa Barat"            : (-6.2349,  106.9896),
    "Cirebon, Jawa Barat"           : (-6.7063,  108.5570),
    "Lampung, Sumatera Selatan"     : (-5.4295,  105.2610),
    "Jakarta Utara, DKI Jakarta"    : (-6.1213,  106.8748),
    "Jakarta Selatan, DKI Jakarta"  : (-6.2615,  106.8106),
    "Bandung, Jawa Barat"           : (-6.9175,  107.6191),
    "Surabaya, Jawa Timur"          : (-7.2575,  112.7521),
    "Yogyakarta, DIY"               : (-7.7956,  110.3695),
    "Bogor, Jawa Barat"             : (-6.5971,  106.8060),
    "Depok, Jawa Barat"             : (-6.4025,  106.7942),
    "Jakarta Pusat, DKI Jakarta"    : (-6.1805,  106.8284),
    "Jakarta Timur, DKI Jakarta"    : (-6.2250,  106.9004),
    "Subang, Jawa Barat"            : (-6.5694,  107.7602),
    "Jakarta Barat, DKI Jakarta"    : (-6.1688,  106.7636),
    "Palembang, Sumatera Selatan"   : (-2.9761,  104.7754),
    "Sragen, Jawa Tengah"           : (-7.4250,  111.0280),
    "Ponorogo, Jawa Timur"          : (-7.8643,  111.4638),
    "Klaten, Jawa Tengah"           : (-7.7059,  110.6014),
    "Solo, Jawa Tengah"             : (-7.5753,  110.8243),
    "Tanggerang, Banten"            : (-6.1783,  106.6319),
    "Serang, Banten"                : (-6.1201,  106.1503),
    "Cilacap, Jawa Tengah"          : (-7.7197,  109.0145),
    "Kota Gede, DIY"                : (-7.8297,  110.3961),
    "Karawang, Jawa Barat"          : (-6.3212,  107.3381),
    "Purwakarat, Jawa Barat"        : (-6.5566,  107.4390),
    "Nganjuk, Jawa Timur"           : (-7.6047,  111.9029),
    "Madura, Jawa Timur"            : (-7.0026,  113.3400),
}

user_clean = user.copy()
user_clean["User_Lat"]  = user_clean["Location"].map(
    lambda loc: LOCATION_COORDS.get(loc, (np.nan, np.nan))[0]
)
user_clean["User_Long"] = user_clean["Location"].map(
    lambda loc: LOCATION_COORDS.get(loc, (np.nan, np.nan))[1]
)
user_clean[["City", "Province"]] = user_clean["Location"].str.split(", ", n=1, expand=True)

bins_a   = [0, 24, 34, 44, 100]
labels_a = ["<25 th", "25-34 th", "35-44 th", "45+ th"]
user_clean["Age_Group"] = pd.cut(user_clean["Age"], bins=bins_a, labels=labels_a)

unmapped = user_clean["User_Lat"].isna().sum()
print(f"  ✓ Geocoding {len(LOCATION_COORDS)} kota  |  Unmapped: {unmapped}")
print("  ✓ Tambah kolom City, Province, Age_Group")
report(user_clean, "user BERSIH")


section("6. MERGE")

tourism_merged = tourism_clean.merge(rating_agg, on="Place_Id", how="left")
tourism_merged["Avg_Rating"]   = tourism_merged["Avg_Rating"].fillna(tourism_merged["Rating"])
tourism_merged["Rating_Count"] = tourism_merged["Rating_Count"].fillna(0).astype(int)
print(f"  ✓ tourism_clean + rating_agg  → shape {tourism_merged.shape}")


section("7. EKSPOR JSON ke folder data/")

def df_to_json(df, filename):
    """Simpan DataFrame sebagai JSON array ke folder data/."""
    df_out = df.copy()
    for col in df_out.select_dtypes(include="category").columns:
        df_out[col] = df_out[col].astype(str)

    path = f"{DATA_DIR}/{filename}"
    records = df_out.where(pd.notnull(df_out), None).to_dict(orient="records")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=2)
    print(f"  ✓ {filename:<35}  ({len(records)} records)")
    return path

df_to_json(tourism_merged, "tourism_merged.json")   
df_to_json(user_clean,     "user_clean.json")        
df_to_json(package_clean,  "package_clean.json")     


