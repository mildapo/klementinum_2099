# Klementinum 2099 – Labyrint poznání

Edukační paměťový simulátor a hra pro ÚISK UK na motivy metody Loci, multisenzorického kódování a aktivního vybavování.

▶️ **Představení projektu a videonávod:** [Sledujte na YouTube](https://youtu.be/Q0y2EopNNyo?si=l5SZy7nzlySgmWO7)

## Jak spustit hru přímo z prostředí GitHubu

Máte dvě možnosti, jak hru a lokální server spustit na svém počítači:

### 1. Rychlé spuštění na Windows (pomocí `spustit.bat`)
Ve složce projektu se nachází předpřipravený skript **`spustit.bat`**:
1. Stáhněte nebo naklonujte tento repozitář.
2. Dvakrát klikněte na soubor **`spustit.bat`**.
   * Pokud máte nainstalovaný **Node.js**, skript automaticky spustí lokální server a otevře hru v prohlížeči na adrese `http://localhost:8787`.
   * Pokud **Node.js** nemáte, skript vás na to upozorní a spustí hru v offline režimu přímo otevřením souboru `index.html`.

---

### 2. Ruční spuštění přes příkazovou řádku (vyžaduje Node.js)
Pokud dáváte přednost ručnímu spuštění nebo používáte jiný operační systém než Windows:

1. **Naklonujte repozitář:**
   ```bash
   git clone https://github.com/mildapo/klementinum_2099.git
   cd klementinum_2099
   ```

2. **Spusťte Node.js server:**
   Aplikace nevyžaduje žádné externí závislosti (využívá pouze vestavěné moduly Node.js). Stačí spustit:
   ```bash
   node server.js
   ```

3. **Otevřete hru v prohlížeči:**
   * **Studentská sekce (hra):** [http://localhost:8787](http://localhost:8787)
   * **Učitelský dashboard (srovnání v reálném čase):** [http://localhost:8787/?teacher=1](http://localhost:8787/?teacher=1)

---

## Sdílení na lokální síti (pro tablety / studenty)
Chcete-li spustit společnou online soutěž se studenty na tabletech či telefonech:
1. Spusťte server (pomocí `spustit.bat` nebo `node server.js`).
2. Server automaticky zjistí vaši IP adresu v síti a zobrazí ji v konzoli.
3. Na **dashboardu učitele** najdete sekci **QR kódy pro sdílení**:
   - QR kód pro **studenty** – stačí namířit kameru telefonu/tabletu
   - QR kód pro **učitele** – otevře dashboard s živým sledováním
   - Tlačítko **📽 Promítat QR kódy na celou obrazovku** – ideální pro projektor ve třídě
4. URL adresy pro ruční zadání:
   - Studenti: `http://<VASE_IP_ADRESA>:8787/?room=KLEMENTINUM`
   - Učitel: `http://<VASE_IP_ADRESA>:8787/?room=KLEMENTINUM&teacher=1`

### Tipy pro učitele
- URL pro sdílení lze zkopírovat jedním klikem tlačítkem **📋 Kopírovat URL**
- QR kódy se automaticky aktualizují podle zvoleného názvu místnosti
- Pro jiný název místnosti změňte pole „Místnost" (např. `TRIDA-3A`)
- Všechna zařízení musí být připojena ke **stejné Wi-Fi síti**

