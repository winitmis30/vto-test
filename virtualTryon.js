import * as Designhubz from 'designhubz-widget'
import React, { createRef, useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import Loader from '@eyewa/core-loader'
import { useRouter } from 'shared/hooks/useRouter'
import EyeglassIcon from './assets/EyeglassIcon.svg'
import Icon3D from './assets/3DTextIcon.svg'
import TryOnIcon from './assets/TryOnIcon.svg'
import CheckCircle from './assets/CheckCircle.svg'
import Close from './assets/Close.svg'
import s from './VirtualTryOn.scss'
import { useProductSwatch } from '@eyewa/core-add-to-cart-form/dist/hooks/useProductSwatch'

import ShareSaveVTO from './ShareSaveVTO'
import { CHECKOUT_CART_URL } from 'shared/constants/index'
import VTOAddToCart from './VTOAddToCart'
import VTORecommendations from './VTORecommendations'
import { useFetchClient } from 'shared/hooks/useFetchClient'

const LOADING_STATES = {
  INITIAL: 'INITIAL',
  MID: 'MID',
  DONE: 'DONE',
}

let widget

const VirtualTryOn = ({ initialVtoId, onClose, urlSlug, customer, pdpData, translate }) => {
  const [vtoLoading, setVtoLoading] = useState(LOADING_STATES.INITIAL)
  const [cartAdded, setCartAdded] = useState(false)
  const [pdValue] = useState()
  const [pageData, setPageData] = useState(pdpData)
  const [recommenedProducts, setRecommendedProducts] = useState([])
  const [productSlug, setProductSlug] = useState(urlSlug)
  const [view, setView] = useState('3d')
  const [screenshotUrl, setScreenshotUrl] = useState('')
  const router = useRouter()
  const { store } = router.params
  const client = useFetchClient()
  const progressRef = createRef()
  const containerRef = createRef()

  const [product] = pageData?.products?.items || [{ swatchData: null }]
  const productStaticContents = pageData?.productStaticContents || {}

  // eslint-disable-next-line
  const { swatchState, swatchDispatcher } = useProductSwatch({ product, productStaticContents })

  const switchView = async () => {
    const nextView = view === '3d' ? 'tryon' : '3d'
    await widget.switchContext()
    setView(nextView)
  }

  const handleLoaderProgress = () => {
    const progressElement = progressRef.current
    let loggedProgress = ''
    const handler = (progress) => {
      if (loggedProgress !== progress.toFixed(1)) {
        loggedProgress = progress.toFixed(1)
        const percent = Math.round(progress * 100)
        if (progressElement !== null) progressElement.style.width = `${percent}%`
      }
    }
    return handler
  }

  const onUserInfoUpdate = () => {
    // eslint-disable-next-line new-cap
    // widget.onUserInfoUpdate.Add((userInfo) => {
    // setPDValue(userInfo?.ipd?.toFixed(2)) // uncomment to show PD value
    // })
  }

  const createWidget = async () => {
    if (!widget) {
      const container = containerRef.current
      if (location.origin.includes('//localhost:')) {
        Designhubz.auth(23049412)
        Designhubz.setDeployment('production')
      }
      widget = await Designhubz.createEyewearWidget(container, handleLoaderProgress())
      toggleVisiblityTryon()
      widget.setUserId((customer?.id || 'test').toString())
      onUserInfoUpdate()
    }
  }

  const fetchRecommendations = async () => {
    const similarProds = await widget.fetchRecommendations()
    setRecommendedProducts(similarProds.map((prod) => prod?.productKey))
  }

  const loadProduct = async (vtoId) => {
    try {
      await widget.loadProduct(vtoId)
    } catch (e) {
      // eslint-disable-next-line
      console.log('something went wrong')
    }
  }

  const changeProductColor = async (variationCode) => {
    await loadProduct(variationCode)
  }

  const toggleWidgetVisibility = (state) => {
  {
    /** @type {HTMLElement} */
    const element = containerRef.current.querySelector('iframe');
    if(element === null) throw `Widget Iframe not found in container`;
    element.hidden = state;
  }

  useEffect(async () => {
    if (initialVtoId) {
      await createWidget()
      toggleWidgetVisibility(false);
      await loadProduct(initialVtoId)

      if (view === '3d') {
        await switchView()
        toggleWidgetVisibility(true);
      }
      setVtoLoading(LOADING_STATES.MID)
      await widget.fetchFitInfo()
      setVtoLoading(LOADING_STATES.DONE)
      fetchRecommendations()
    }
  }, [])

  useEffect(async () => {
    if (productSlug !== urlSlug || !initialVtoId) {
      setRecommendedProducts([])
      await createWidget()
      const PRODUCT_LIST_END_POINT = `/catalog/${store}/getpage`
      if (vtoLoading === LOADING_STATES.DONE) {
        setVtoLoading(LOADING_STATES.MID)
      }
      const data = await client.post(PRODUCT_LIST_END_POINT, {
        options: {
          sort: {
            position: 'ASC',
          },
          currentPage: 1,
        },
        url: `${productSlug}.html`,
      })
      const resp = data?.data?.data

      await loadProduct(resp?.products?.items?.[0]?.variationCode)

      if (view === '3d') {
        await switchView()
      }
      setPageData(resp)
      if (vtoLoading === LOADING_STATES.INITIAL) {
        setVtoLoading(LOADING_STATES.MID)
      }
      await widget.fetchFitInfo()
      setVtoLoading(LOADING_STATES.DONE)
      fetchRecommendations()
    }
  }, [productSlug])

  useEffect(
    () => () => {
      widget = null
    },
    []
  )

  const saveToDevice = () => {
    const link = document.createElement('a')
    link.download = 'capture.png'
    link.href = screenshotUrl
    link.click()
    link.remove()
  }

  const takeSnaphot = async () => {
    const snapshot = await widget?.takeSnapshotAsync()
    const blob = await snapshot.getBlobAsync('jpeg', 80)
    return URL.createObjectURL(blob)
  }

  const takeScreenShot = async () => {
    const imgUrl = await takeSnaphot()
    setScreenshotUrl(imgUrl)
  }

  return (
    <div>
      <div className={s.wrapper} ref={containerRef}>
        {screenshotUrl ? (
          <div className={s.screenshotCaptured}>
            <span className={s.captureText}>
              <span>
                <CheckCircle />
              </span>
              {'  '}
              <span>{translate('Image Captured')}.</span>
            </span>
            <span className={s.close} onClick={() => setScreenshotUrl('')}>
              {translate('Close')}
            </span>
          </div>
        ) : (
          ''
        )}
        {screenshotUrl ? <img className={s.screenshot} src={screenshotUrl} alt='screenshot' /> : ''}
        {vtoLoading === LOADING_STATES.INITIAL && (
          <div className={s.splashLoader}>
            <div>
              <EyeglassIcon />
            </div>
            <p>{translate('Virtual experience is loading...')}</p>
            <div className={s.progressWrap}>
              <div ref={progressRef} className={s.progress} />
            </div>
            <p className={s.blurText} />
            <section className={s.blurText}>
              <div>
                {translate(
                  'We are committed to protecting your privacy. We use the information provided to personalise your experience and not store any data'
                )}
              </div>
            </section>
          </div>
        )}
        <div className={s.vtoHeader}>
          {vtoLoading === LOADING_STATES.DONE && !screenshotUrl ? (
            <div className={s.switchIcon} onClick={switchView}>
              {view === '3d' ? <TryOnIcon /> : <Icon3D />}
            </div>
          ) : (
            <div />
          )}
          <div className={s.close} onClick={onClose}>
            <Close />
          </div>
        </div>

        {vtoLoading === LOADING_STATES.DONE && (
          <VTOAddToCart
            pageData={pageData}
            setCartAdded={setCartAdded}
            onClose={onClose}
            changeProductColor={changeProductColor}
            screenshotUrl={screenshotUrl}
          />
        )}
        {vtoLoading === LOADING_STATES.DONE && view === 'tryon' && (
          <>
            {pdValue && (
              <div className={s.pdWrap}>
                PD - <span>{Math.round(pdValue * 10)}mm</span>
              </div>
            )}
            {screenshotUrl ? (
              <ShareSaveVTO saveToDevice={saveToDevice} translate={translate} />
            ) : (
              <VTORecommendations
                takeScreenShot={takeScreenShot}
                recommenedProducts={recommenedProducts}
                setSelectedSlug={(val) => setProductSlug(val)}
              />
            )}
          </>
        )}
      </div>

      {vtoLoading === LOADING_STATES.MID && (
        <div className={s.circleLoader}>
          <Loader size='lg' />
        </div>
      )}

      {cartAdded && (
        <div className={s.cartNotification}>
          <p className={s.message}>{translate('Product added to cart')}</p>
          <p
            onClick={() => {
              router.push(`/${store}${CHECKOUT_CART_URL}`)
            }}
            className={s.view}
          >
            {translate('View cart')}
          </p>
        </div>
      )}
    </div>
  )
}

VirtualTryOn.propTypes = {
  initialVtoId: PropTypes.string.isRequired,
  urlSlug: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired,
  customer: PropTypes.object.isRequired,
  translate: PropTypes.func.isRequired,
  pdpData: PropTypes.object,
}

export default VirtualTryOn
