import React, { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import Header from '@/components/Header';
import AutoClickAd from '@/components/AutoClickAd';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Star, Play, Calendar, Clock } from 'lucide-react';
import { useIncrementMovieViews, useIncrementEpisodeViews, useIncrementShowEpisodeViews } from '@/hooks/useViewTracking';

const Player = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const episodeId = searchParams.get('episode');
  const content = location.state || {};
  const [currentEpisode, setCurrentEpisode] = useState(null);
  const [currentSeasonDetails, setCurrentSeasonDetails] = useState(null);
  const [videoError, setVideoError] = useState(false);
  const [isVideoLoading, setIsVideoLoading] = useState(true);
  const [adsLoaded, setAdsLoaded] = useState(false);

  const incrementMovieViews = useIncrementMovieViews();
  const incrementEpisodeViews = useIncrementEpisodeViews();
  const incrementShowEpisodeViews = useIncrementShowEpisodeViews();

  // Load simple ads immediately
  useEffect(() => {
    console.log('Loading ads for Player page');
    setTimeout(() => {
      setAdsLoaded(true);
    }, 1000);
  }, []);

  // Fetch episode details if episodeId is provided
  useEffect(() => {
    const fetchEpisodeDetails = async () => {
      if (episodeId) {
        setIsVideoLoading(true);
        try {
          const { supabase } = await import('@/integrations/supabase/client');
          const { data: episodeData, error } = await supabase
            .from('episode')
            .select('*')
            .eq('episode_id', episodeId)
            .single();

          if (!error && episodeData) {
            setCurrentEpisode(episodeData);
          }
        } catch (err) {
          console.error('Error fetching episode details:', err);
        } finally {
          setIsVideoLoading(false);
        }
      } else {
        setIsVideoLoading(false);
      }
    };

    fetchEpisodeDetails();
    setVideoError(false);
  }, [episodeId]);

  // Get season details for web series
  useEffect(() => {
    const fetchSeasonDetails = async () => {
      if (content.content_type === 'Web Series' && content.web_series?.season_id_list) {
        try {
          const { supabase } = await import('@/integrations/supabase/client');
          const seasonId = content.web_series.season_id_list[0];

          if (seasonId) {
            const { data: seasonData, error } = await supabase
              .from('season')
              .select('*')
              .eq('season_id', seasonId)
              .single();

            if (!error && seasonData) {
              setCurrentSeasonDetails(seasonData);
            }
          }
        } catch (err) {
          console.error('Error fetching season details:', err);
        }
      }
    };

    fetchSeasonDetails();
  }, [content]);

  // Get the actual video URL based on content type
  const getVideoUrl = () => {
    if (currentEpisode?.video_url) {
      return currentEpisode.video_url;
    }

    if (content.content_type === 'Movie' && content.movie?.video_url) {
      return content.movie.video_url;
    } 

    if (content.content_type === 'Web Series') {
      if (content.web_series?.seasons?.[0]?.episodes?.[0]?.video_url) {
        return content.web_series.seasons[0].episodes[0].video_url;
      }
    }

    if (content.content_type === 'Show') {
      if (content.show?.episode_id_list?.length > 0) {
        const showVideoUrl = content.videoUrl || content.video_url;
        return showVideoUrl;
      }
    }

    const fallbackUrl = content.videoUrl || content.video_url || content.movie?.video_url;
    return fallbackUrl || '';
  };

  const videoUrl = getVideoUrl();

  // Convert video page URLs to direct video URLs or embed URLs
  const getVideoUrlForPlayer = (url) => {
    if (url.includes('bitchute.com/video/')) {
      const videoId = url.split('/video/')[1].split('?')[0];
      return `https://www.bitchute.com/embed/${videoId}?autoplay=0&hide_share=1&hide_sidebar=1&hide_related=1&disable_download=1`;
    }

    if (url.includes('odysee.com/')) {
      let videoPath = '';
      if (url.includes('odysee.com/@')) {
        const parts = url.split('odysee.com/')[1];
        videoPath = parts;
      } else if (url.includes('lbry.tv/')) {
        const parts = url.split('lbry.tv/')[1];
        videoPath = parts;
      }
      if (videoPath) {
        return `https://odysee.com/$/embed/${videoPath}`;
      }
    }

    if (url.includes('youtube.com/watch?v=')) {
      const videoId = url.split('v=')[1].split('&')[0];
      return `https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0&modestbranding=1`;
    }
    if (url.includes('youtu.be/')) {
      const videoId = url.split('youtu.be/')[1].split('?')[0];
      return `https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0&modestbranding=1`;
    }

    if (url.includes('vimeo.com/')) {
      const videoId = url.split('vimeo.com/')[1];
      return `https://player.vimeo.com/video/${videoId}?autoplay=0`;
    }

    if (url.includes('dailymotion.com/video/')) {
      const videoId = url.split('/video/')[1];
      return `https://www.dailymotion.com/embed/video/${videoId}?autoplay=0`;
    }

    return url;
  };

  // Auto-reload logic
  useEffect(() => {
    let refreshTimer: NodeJS.Timeout;

    const setupAutoRefresh = () => {
      let estimatedDuration = 15 * 60 * 1000;

      if (currentEpisode?.duration) {
        estimatedDuration = currentEpisode.duration * 60 * 1000;
      } else if (content.content_type === 'Movie' && content.movie?.duration) {
        estimatedDuration = content.movie.duration * 60 * 1000;
      }

      estimatedDuration = Math.min(Math.max(estimatedDuration + 30000, 5 * 60 * 1000), 45 * 60 * 1000);

      if (videoUrl && videoUrl.includes('bitchute.com')) {
        estimatedDuration = Math.min(estimatedDuration, 10 * 60 * 1000);
      }

      refreshTimer = setTimeout(() => {
        window.location.reload();
      }, estimatedDuration);
    };

    if (videoUrl && !videoError) {
      setupAutoRefresh();
    }

    return () => {
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }
    };
  }, [videoUrl, videoError, currentEpisode, content]);

  // View tracking logic
  useEffect(() => {
    let viewTimer: NodeJS.Timeout;

    const sessionKey = episodeId ? `episode_${episodeId}` : `content_${id}`;
    const hasTrackedKey = `view_tracked_${sessionKey}`;
    const hasTrackedView = sessionStorage.getItem(hasTrackedKey) === 'true';

    const trackView = async () => {
      if (!hasTrackedView && content && (id || episodeId)) {
        try {
          const contentType = content.content_type?.toLowerCase() || content.type?.toLowerCase();
          let trackingPromise = null;

          if (contentType === 'movie' && id) {
            trackingPromise = incrementMovieViews.mutateAsync(id);
          } else if (episodeId) {
            trackingPromise = incrementEpisodeViews.mutateAsync(episodeId);
          } else if (contentType === 'show' && content.show?.episode_id_list?.[0]) {
            const firstEpisodeId = content.show.episode_id_list[0];
            trackingPromise = incrementShowEpisodeViews.mutateAsync(firstEpisodeId);
          } else if (contentType === 'web series' && content.web_series?.seasons?.[0]?.episodes?.[0]) {
            const firstEpisode = content.web_series.seasons[0].episodes[0];
            if (firstEpisode.episode_id) {
              trackingPromise = incrementEpisodeViews.mutateAsync(firstEpisode.episode_id);
            }
          }

          if (trackingPromise) {
            await trackingPromise;
            sessionStorage.setItem(hasTrackedKey, 'true');
          }
        } catch (error) {
          console.error('Error tracking view:', error);
        }
      }
    };

    if (content && videoUrl && !videoError && !hasTrackedView && (id || episodeId)) {
      viewTimer = setTimeout(() => {
        trackView();
      }, 30000);
    }

    return () => {
      if (viewTimer) {
        clearTimeout(viewTimer);
      }
    };
  }, [content, currentEpisode, id, incrementMovieViews, incrementEpisodeViews, incrementShowEpisodeViews, episodeId, videoUrl, videoError]);

  const getContentTypeDisplay = () => {
    switch (content.content_type) {
      case 'Movie': return 'Movie';
      case 'Web Series': return 'Web Series';
      case 'Show': return 'TV Show';
      default: 
        if (content.type === 'series') return 'Web Series';
        if (content.type === 'show') return 'TV Show';
        return content.content_type || content.type || 'Content';
    }
  };

  const getEpisodeInfo = () => {
    if (currentEpisode) {
      const episodeMatch = currentEpisode.title?.match(/episode\s*(\d+)/i);
      if (episodeMatch) {
        return `Episode ${episodeMatch[1]}`;
      }
      return `Episode ${currentEpisode.episode_number || '1'}`;
    }
    return null;
  };

  const getSeasonInfo = () => {
    if (content.content_type === 'Web Series') {
      if (currentSeasonDetails?.season_number) {
        return `Season ${currentSeasonDetails.season_number}`;
      } else if (content.seasonNumber) {
        return `Season ${content.seasonNumber}`;
      }
      return 'Season 1';
    }
    return null;
  };

  const getDuration = () => {
    if (currentEpisode?.duration) {
      return `${currentEpisode.duration} min`;
    }
    if (content.content_type === 'Movie' && content.movie?.duration) {
      return `${content.movie.duration} min`;
    }
    return null;
  };

  const getDescription = () => {
    if (currentEpisode?.description) {
      return currentEpisode.description;
    }
    if (content.content_type === 'Movie' && content.movie?.description) {
      return content.movie.description;
    } else if (content.content_type === 'Web Series' && currentSeasonDetails?.season_description) {
      return currentSeasonDetails.season_description;
    } else if (content.content_type === 'Show' && content.show?.description) {
      return content.show.description;
    }
    return content.description || 'No description available';
  };

  const getRatingInfo = () => {
    if (content.content_type === 'Movie' && content.movie) {
      return {
        rating_type: content.movie.rating_type,
        rating: content.movie.rating,
        release_year: content.movie.release_year
      };
    } else if (content.content_type === 'Web Series' && currentSeasonDetails) {
      return {
        rating_type: currentSeasonDetails.rating_type,
        rating: currentSeasonDetails.rating,
        release_year: currentSeasonDetails.release_year
      };
    } else if (content.content_type === 'Show' && content.show) {
      return {
        rating_type: content.show.rating_type,
        rating: content.show.rating,
        release_year: content.show.release_year
      };
    }
    return {
      rating_type: content.rating_type || content.rating || 'Not Rated',
      rating: content.score || content.rating || 0,
      release_year: content.year || content.release_year || new Date().getFullYear()
    };
  };

  const ratingInfo = getRatingInfo();

  const handlePlay = () => {
    console.log('Video started playing');
  };

  // Safety check
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      const hasValidContent = content && (content.content_type || content.type);
      const hasValidIds = id || episodeId;
      const hasVideoUrl = !!videoUrl;
      const isStillLoading = isVideoLoading;

      if (!hasValidContent && !hasValidIds && !hasVideoUrl && !isStillLoading) {
        navigate('/', { replace: true });
      }
    }, 10000);

    return () => clearTimeout(timeoutId);
  }, [content, navigate, episodeId, id, videoUrl, isVideoLoading]);

  // Show loading screen while ads are loading
  if (!adsLoaded) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="pt-20">
          <div className="container mx-auto px-6 py-8">
            <div className="flex items-center justify-center h-96">
              <div className="text-center">
                <div className="text-lg mb-4">Loading advertisements...</div>
                <div className="text-sm text-gray-400">
                  Preparing content...
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="pt-20">
        <div className="container mx-auto px-6 py-8">
          <div className="flex items-center gap-4 mb-6">
            <Button
              onClick={() => navigate(-1)}
              variant="outline"
              size="sm"
              className="bg-primary/5 backdrop-blur-sm border border-primary/30 text-primary hover:bg-gradient-to-br hover:from-black/30 hover:via-[#0A7D4B]/5 hover:to-black/30 hover:border-primary/20 transition-all duration-300"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </div>

          <div className="space-y-8">
            {/* Video Player Section */}
            <Card className="bg-gradient-to-br from-black/90 via-[#0A7D4B]/20 to-black/90 backdrop-blur-sm border border-border/50 wave-transition relative overflow-hidden">
              <div className="absolute inset-0">
                <div className="player-wave-bg-1"></div>
                <div className="player-wave-bg-2"></div>
                <div className="player-wave-bg-3"></div>
              </div>

              <CardContent className="p-8 relative z-10">
                {/* Video Player */}
                <div className="w-full max-w-4xl mx-auto mb-8">
                  <div className="aspect-video bg-gradient-to-br from-black/95 via-[#0A7D4B]/10 to-black/95 rounded-xl relative border border-primary/20 shadow-2xl overflow-hidden custom-video-container">
                    {isVideoLoading && !content ? (
                      <div className="w-full h-full rounded-xl bg-gradient-to-br from-black/95 via-[#0A7D4B]/10 to-black/95 flex items-center justify-center">
                        <div className="text-center">
                          <div className="w-20 h-20 mx-auto mb-4 bg-primary/20 rounded-full flex items-center justify-center border border-primary/30 animate-pulse">
                            <Play className="w-8 h-8 text-primary fill-current animate-spin" />
                          </div>
                          <div className="text-primary text-xl font-semibold mb-2 animate-pulse">
                            Loading Content...
                          </div>
                          <p className="text-muted-foreground text-sm">
                            Please wait while we prepare your video
                          </p>
                        </div>
                      </div>
                    ) : videoUrl && !videoError ? (
                      <div className="relative w-full h-full">
                        {videoUrl.includes('bitchute.com') || videoUrl.includes('odysee.com') || videoUrl.includes('lbry.tv') || videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be') || videoUrl.includes('vimeo.com') || videoUrl.includes('dailymotion.com') ? (
                          <iframe
                            className="w-full h-full rounded-xl"
                            src={getVideoUrlForPlayer(videoUrl)}
                            title="Video Player"
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                            onLoad={() => setIsVideoLoading(false)}
                            onError={() => {
                              setVideoError(true);
                              setIsVideoLoading(false);
                            }}
                            style={{
                              filter: 'contrast(1.1) brightness(1.05)',
                              outline: 'none',
                              transition: 'opacity 0.3s ease'
                            }}
                          />
                        ) : (
                          <video
                            className="w-full h-full rounded-xl object-cover custom-video-player"
                            controls
                            poster={content.image || content.thumbnail_url || content.movie?.thumbnail_url}
                            preload="metadata"
                            autoPlay={false}
                            onLoadStart={() => setIsVideoLoading(true)}
                            onCanPlay={() => setIsVideoLoading(false)}
                            onError={() => {
                              setVideoError(true);
                              setIsVideoLoading(false);
                            }}
                            onEnded={() => {
                              setTimeout(() => {
                                window.location.reload();
                              }, 2000);
                            }}
                            onPlay={handlePlay}
                            style={{
                              filter: 'contrast(1.1) brightness(1.05)',
                              outline: 'none',
                              transition: 'opacity 0.3s ease'
                            }}
                          >
                            <source src={getVideoUrlForPlayer(videoUrl)} type="video/mp4" />
                            <source src={getVideoUrlForPlayer(videoUrl)} type="video/webm" />
                            <source src={getVideoUrlForPlayer(videoUrl)} type="video/ogg" />
                            Your browser does not support the video tag.
                          </video>
                        )}

                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20 pointer-events-none"></div>
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20 pointer-events-none"></div>
                      </div>
                    ) : (
                      <div className="w-full h-full rounded-xl bg-gradient-to-br from-black/95 via-[#0A7D4B]/10 to-black/95 flex items-center justify-center">
                        <div className="text-center">
                          <div className="w-20 h-20 mx-auto mb-4 bg-primary/20 rounded-full flex items-center justify-center border border-primary/30">
                            <Play className="w-8 h-8 text-primary fill-current" />
                          </div>
                          <div className="text-primary text-xl font-semibold mb-2">
                            {videoError ? "Unable to Play Content" : "⚠️ Video Not Available"}
                          </div>
                          <p className="text-muted-foreground text-sm">
                            {videoError ? "The video could not be loaded or played" : "No video URL found for this content"}
                          </p>
                          {!videoError && (
                            <p className="text-xs text-muted-foreground/70 mt-2">
                              Content Type: {getContentTypeDisplay()}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Content Information */}
                <div className="max-w-4xl mx-auto space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <h1 className="text-3xl font-bold text-foreground">
                      {content.content_type === 'Web Series' ? content.title : 
                       content.content_type === 'Show' ? content.show?.title || content.title :
                       currentEpisode?.title || content.title}
                    </h1>
                    <div className="flex items-center space-x-3">
                      {content.content_type === 'Web Series' && getSeasonInfo() && (
                        <span className="bg-gradient-to-r from-blue-500/20 to-blue-600/20 text-blue-300 px-3 py-1 rounded-md border border-blue-500/30 text-sm font-medium">
                          {getSeasonInfo()}
                        </span>
                      )}
                      {(content.content_type === 'Web Series' || content.content_type === 'Show') && getEpisodeInfo() && (
                        <span className="bg-gradient-to-r from-purple-500/20 to-purple-600/20 text-purple-300 px-3 py-1 rounded-md border border-purple-500/30 text-sm font-medium">
                          {getEpisodeInfo()}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-4 flex-wrap">
                    {ratingInfo.rating_type && (
                      <span className="bg-primary/20 text-primary px-3 py-1 rounded-md border border-primary/30 text-sm font-medium">
                        {ratingInfo.rating_type}
                      </span>
                    )}
                    {ratingInfo.rating && (
                      <div className="flex items-center space-x-1">
                        <Star className="h-4 w-4 text-yellow-400 fill-current" />
                        <span className="text-foreground text-sm font-medium">
                          {ratingInfo.rating}
                        </span>
                      </div>
                    )}
                    {ratingInfo.release_year && (
                      <span className="text-muted-foreground text-sm font-medium">
                        {ratingInfo.release_year}
                      </span>
                    )}
                    {getDuration() && (
                      <div className="flex items-center space-x-1">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground text-sm font-medium">
                          {getDuration()}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-foreground">Description</h3>
                    <p className="text-muted-foreground text-base leading-relaxed">
                      {getDescription()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Advertisement Section */}
            <div className="w-full">
              <Card className="bg-gradient-to-br from-black/40 via-[#0A7D4B]/10 to-black/40 backdrop-blur-sm border border-border/30">
                <CardContent className="p-4 sm:p-6 space-y-6 sm:space-y-8">
                  {/* First Ad - Banner */}
                  <div className="w-full flex justify-center">
                    <div 
                      id="player-ad-1" 
                      className="w-full bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-lg p-6 text-center cursor-pointer hover:from-blue-600/30 hover:to-purple-600/30 transition-all duration-300"
                      style={{ minHeight: '120px' }}
                      dangerouslySetInnerHTML={{
                        __html: `
                          <a href="https://adsterra.com" target="_blank" style="text-decoration: none; color: inherit; display: block;">
                            <div style="font-size: 18px; font-weight: bold; color: #60a5fa; margin-bottom: 8px;">
                              🎬 Premium Streaming Experience
                            </div>
                            <div style="font-size: 14px; color: #94a3b8; margin-bottom: 8px;">
                              Unlock unlimited entertainment with our premium features
                            </div>
                            <div style="font-size: 12px; color: #64748b;">
                              Click to explore premium options
                            </div>
                          </a>
                        `
                      }}
                    />
                  </div>

                  {/* Second Ad - Mobile Banner */}
                  <div className="w-full flex justify-center">
                    <div 
                      id="player-ad-2" 
                      className="w-full max-w-md bg-gradient-to-r from-green-600/20 to-teal-600/20 border border-green-500/30 rounded-lg p-4 text-center cursor-pointer hover:from-green-600/30 hover:to-teal-600/30 transition-all duration-300"
                      style={{ minHeight: '80px' }}
                      dangerouslySetInnerHTML={{
                        __html: `
                          <a href="https://adsterra.com" target="_blank" style="text-decoration: none; color: inherit; display: block;">
                            <div style="font-size: 16px; font-weight: bold; color: #34d399; margin-bottom: 4px;">
                              💰 Earn While You Watch
                            </div>
                            <div style="font-size: 12px; color: #94a3b8;">
                              Join our rewards program today!
                            </div>
                          </a>
                        `
                      }}
                    />
                  </div>

                  {/* Third and Fourth Ads - Side by Side */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
                    {/* Third Ad - Medium Rectangle */}
                    <div className="flex justify-center">
                      <div 
                        id="player-ad-3" 
                        className="w-full bg-gradient-to-br from-orange-600/20 to-red-600/20 border border-orange-500/30 rounded-lg p-6 text-center cursor-pointer hover:from-orange-600/30 hover:to-red-600/30 transition-all duration-300"
                        style={{ minHeight: '280px' }}
                        dangerouslySetInnerHTML={{
                          __html: `
                            <a href="https://adsterra.com" target="_blank" style="text-decoration: none; color: inherit; display: block; height: 100%;">
                              <div style="font-size: 17px; font-weight: bold; color: #fb923c; margin-bottom: 12px;">
                                🚀 Boost Your Experience
                              </div>
                              <div style="font-size: 13px; color: #94a3b8; margin-bottom: 16px; line-height: 1.5;">
                                Get faster streaming, HD quality, and exclusive content with our advanced features.
                              </div>
                              <div style="background: rgba(251, 146, 60, 0.2); padding: 8px 16px; border-radius: 6px; display: inline-block;">
                                <div style="font-size: 11px; color: #fb923c; font-weight: 600;">
                                  UPGRADE NOW
                                </div>
                              </div>
                            </a>
                          `
                        }}
                      />
                    </div>

                    {/* Fourth Ad - Skyscraper */}
                    <div className="flex justify-center">
                      <div 
                        id="player-ad-4" 
                        className="w-full max-w-xs bg-gradient-to-b from-purple-600/20 to-pink-600/20 border border-purple-500/30 rounded-lg p-6 text-center cursor-pointer hover:from-purple-600/30 hover:to-pink-600/30 transition-all duration-300"
                        style={{ minHeight: '350px' }}
                        dangerouslySetInnerHTML={{
                          __html: `
                            <a href="https://adsterra.com" target="_blank" style="text-decoration: none; color: inherit; display: block; height: 100%;">
                              <div style="font-size: 16px; font-weight: bold; color: #c084fc; margin-bottom: 16px;">
                                🎯 Special Offers
                              </div>
                              <div style="font-size: 12px; color: #94a3b8; margin-bottom: 20px; line-height: 1.4;">
                                Limited time deals on premium content and exclusive features.
                              </div>
                              <div style="background: rgba(192, 132, 252, 0.2); padding: 12px; border-radius: 8px; margin-bottom: 16px;">
                                <div style="font-size: 14px; color: #c084fc; font-weight: bold; margin-bottom: 4px;">
                                  50% OFF
                                </div>
                                <div style="font-size: 10px; color: #94a3b8;">
                                  First Month
                                </div>
                              </div>
                              <div style="font-size: 10px; color: #64748b;">
                                Click to claim offer
                              </div>
                            </a>
                          `
                        }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {adsLoaded && <AutoClickAd pageType="player" />}
    </div>
  );
};

export default Player;