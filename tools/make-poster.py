
from PIL import Image, ImageDraw, ImageFont
import os

W, H = 1080, 1440
BG = (251, 248, 243)
INK = (18, 60, 74)
ACCENT = (196, 118, 66)
MUTED = (110, 110, 110)

img = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(img)

def font(size, bold=False):
    for p in [r"C:\Windows\Fonts\msyhbd.ttc" if bold else r"C:\Windows\Fonts\msyh.ttc",
              r"C:\Windows\Fonts\simhei.ttf", r"C:\Windows\Fonts\arial.ttf"]:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                continue
    return ImageFont.load_default()

def center(text, y, f, fill):
    w = d.textlength(text, font=f)
    d.text(((W - w) / 2, y), text, font=f, fill=fill)

# 顶部品牌
center("行　价", 90, font(92, True), INK)
center("旅费预算 · 出门前先算清这趟要花多少", 210, font(34), MUTED)

# 二维码卡片
qr = Image.open(r"D:\旅游费用查询网站\分享\网址二维码.png").convert("RGB")
qsize = 620
qr = qr.resize((qsize, qsize), Image.LANCZOS)
card_x = (W - qsize) // 2 - 30
card_y = 300
card_w = qsize + 60
card_h = qsize + 60
d.rounded_rectangle([card_x, card_y, card_x + card_w, card_y + card_h], radius=28, fill=(255, 255, 255), outline=(228, 222, 212), width=3)
img.paste(qr, ((W - qsize) // 2, card_y + 30))

# 提示语
center("微信 / 相机 扫一扫，直接打开", 1010, font(36, True), INK)
center("注册后即可查 348 个城市的酒店、门票、车费", 1065, font(28), MUTED)

# 网址
center("https://travel-cost-80.netlify.app", 1140, font(30), ACCENT)

# 底部标签
tags = ["348 个旅游城市", "2233 家酒店", "1291 个景点", "城际车费", "一键算总价"]
y = 1230
x = 90
f_tag = font(26)
for t in tags:
    tw = d.textlength(t, font=f_tag)
    d.rounded_rectangle([x, y, x + tw + 44, y + 54], radius=27, fill=(255, 255, 255), outline=(226, 220, 210), width=2)
    d.text((x + 22, y + 12), t, font=f_tag, fill=INK)
    x += tw + 44 + 16
    if x > W - 140:
        x = 90
        y += 68

img.save(r"D:\旅游费用查询网站\分享\分享海报.png", "PNG")
print("poster ok", os.path.getsize(r"D:\旅游费用查询网站\分享\分享海报.png"))