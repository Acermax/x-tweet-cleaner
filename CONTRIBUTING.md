# Guía de Contribución

¡Gracias por tu interés en contribuir a X Tweet Cleaner! 🎉

## Formas de contribuir

### 🐛 Reportar bugs

Si encuentras un problema:

1. Busca en [issues existentes](../../issues) para ver si ya fue reportado
2. Si no existe, [abre un nuevo issue](../../issues/new?template=bug_report.md)
3. Incluye toda la información posible (navegador, pasos para reproducir, screenshots)

### 💡 Sugerir funcionalidades

¿Tienes una idea para mejorar la extensión?

1. Revisa los [issues existentes](../../issues) para ver si ya fue sugerida
2. [Abre un nuevo issue](../../issues/new?template=feature_request.md) describiendo tu idea

### 🔧 Actualizar selectores

X cambia su interfaz frecuentemente. Si la extensión deja de funcionar:

1. Abre DevTools (F12) en X.com
2. Inspecciona los elementos relevantes (tweets, botones, menús)
3. Encuentra los nuevos selectores (busca `data-testid` o clases únicas)
4. [Abre un issue](../../issues/new?template=broken_selectors.md) o envía un PR

### 📝 Enviar código

#### Setup local

```bash
# Clona el repositorio
git clone https://github.com/tu-usuario/x-tweet-cleaner.git
cd x-tweet-cleaner

# Crea una rama para tu cambio
git checkout -b mi-mejora
```

#### Prueba tus cambios

1. Ve a `chrome://extensions/`
2. Activa "Modo desarrollador"
3. Carga la carpeta del proyecto
4. Prueba en X.com
5. Después de cambios, recarga la extensión

#### Envía tu PR

1. Haz commit de tus cambios:
   ```bash
   git add .
   git commit -m "Descripción clara del cambio"
   ```

2. Push a tu fork:
   ```bash
   git push origin mi-mejora
   ```

3. Abre un Pull Request desde GitHub

## Estilo de código

- **JavaScript:** Sin punto y coma, comillas simples
- **CSS:** Usar variables CSS cuando sea posible
- **Comentarios:** En español o inglés, claros y concisos

## Estructura del proyecto

```
├── manifest.json     # Configuración de la extensión
├── popup.html        # UI del popup
├── popup.css         # Estilos del popup
├── popup.js          # Lógica del popup
├── content.js        # Script que corre en X.com
├── content.css       # Estilos inyectados en X.com
└── icons/            # Iconos de la extensión
```

## Preguntas

¿Tienes dudas? Abre un issue con la etiqueta `question`.

---

¡Gracias por contribuir! 🙏
