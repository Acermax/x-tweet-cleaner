---
name: 🔧 Selectores Rotos
about: X cambió su interfaz y la extensión dejó de funcionar
title: '[SELECTORES] La extensión no puede eliminar tweets'
labels: selectors, bug
assignees: ''
---

## Descripción
La extensión no puede encontrar/eliminar tweets porque X actualizó su interfaz.

## ¿Qué parte no funciona?
- [ ] No encuentra los tweets
- [ ] No puede hacer clic en el menú (tres puntos)
- [ ] No encuentra el botón "Eliminar"
- [ ] No puede confirmar la eliminación
- [ ] Otro: _________

## Nuevos selectores (si los encontraste)
Si inspeccionaste el DOM y encontraste los nuevos selectores, compártelos:

```javascript
// Ejemplo:
tweet: 'nuevo-selector-aquí',
moreButton: 'nuevo-selector-del-menu',
```

## Cómo encontrar los selectores
1. Abre X.com y ve a tu perfil
2. Abre DevTools (F12)
3. Usa el inspector para examinar los elementos
4. Busca atributos `data-testid` o clases únicas

## Entorno
- **Navegador:** [ej. Chrome 120]
- **Fecha:** [ej. 15 de enero 2025]

## Screenshots del DOM
Si es posible, incluye capturas del inspector mostrando la estructura actual.
