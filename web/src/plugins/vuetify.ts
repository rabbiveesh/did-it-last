import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'
import { createVuetify } from 'vuetify'

export default createVuetify({
  theme: {
    defaultTheme: 'system',
    themes: {
      light: { colors: { primary: '#00897b', secondary: '#5c6bc0', accent: '#ffb300' } },
      dark: { colors: { primary: '#4db6ac', secondary: '#9fa8da', accent: '#ffca28' } },
    },
  },
  defaults: {
    VBtn: { size: 'large' },
    VCard: { rounded: 'xl' },
  },
})
