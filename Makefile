EXTENSION_UUID = linear-notifications@tbj.dev
EXTENSION_DIR = ~/.local/share/gnome-shell/extensions/$(EXTENSION_UUID)

build:
	glib-compile-schemas schemas/

install: build
	mkdir -p $(EXTENSION_DIR)
	cp *.js *.svg metadata.json $(EXTENSION_DIR)/
	cp -r schemas $(EXTENSION_DIR)/

uninstall:
	rm -rf $(EXTENSION_DIR)

clean:
	npm run clean
	rm -f schemas/gschemas.compiled

pack: build
	gnome-extensions pack --force --out-dir=dist

.PHONY: build install uninstall clean pack
