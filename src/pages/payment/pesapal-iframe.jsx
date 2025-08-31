import { useRouter } from 'next/router'
import Head from 'next/head'
import { Box, Heading, Text } from '@chakra-ui/react'

export default function PesapalIframePage() {
  const router = useRouter()
  const { redirectUrl } = router.query || {}

  return (
    <Box p={6}>
      <Head>
        <title>Complete Payment</title>
      </Head>
      <Heading size="lg" mb={4}>Complete Your Payment</Heading>
      {!redirectUrl ? (
        <Text>No payment URL provided.</Text>
      ) : (
        <Box borderWidth="1px" borderRadius="md" overflow="hidden">
          <iframe
            title="Pesapal Payment"
            src={String(redirectUrl)}
            style={{ width: '100%', height: '80vh', border: '0' }}
          />
        </Box>
      )}
    </Box>
  )
}

