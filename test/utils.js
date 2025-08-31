import React from 'react'
import { ChakraProvider } from '@chakra-ui/react'
import { render } from '@testing-library/react'
import theme from '@/styles/theme'

export const renderWithChakra = (ui, options) =>
  render(<ChakraProvider theme={theme}>{ui}</ChakraProvider>, options)

