import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import Header from '@/components/Header';
import TrailerModal from '@/components/TrailerModal';
import AutoClickAd from '@/components/AutoClickAd';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Play, ExternalLink, ChevronDown, ArrowLeft, Star, Calendar, Clock } from 'lucide-react';
import { useAllContent } from '@/hooks/useContentQueries';

const Details: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [isSeasonDropdownOpen, setIsSeasonDropdownOpen] = useState(false);
  const [showAllDetails, setShowAllDetails] = useState(false);
  const [currentSeasonDetails, setCurrentSeasonDetails] = useState<any>(null);
  const [currentSeasonEpisodes, setCurrentSeasonEpisodes] = useState<any[]>([]);
  const [isTrailerModalOpen, setIsTrailerModalOpen] = useState(false);
  const [adsLoaded, setAdsLoaded] = useState(false);

  const { data: allContent, isLoading } = useAllContent();

  // Load simple ads immediately
  useEffect(() => {
    console.log('Loading ads for Details page');
    setTimeout(() => {
      setAdsLoaded(true);
    }, 1000);
  }, []);

  // Find the content item
  const content = React.useMemo(() => {
    if (location.state && typeof location.state === 'object') {
      return location.state;
    }

    if (!allContent || !id) return null;

    const allItems = [
      ...(allContent.movies || []),
      ...(allContent.webSeries || []),
      ...(allContent.shows || [])
    ];

    return allItems.find(item => {
      if (item.id === id || item.content_id === id) return true;
      if (typeof item.id === 'string' && item.id.includes('-season-')) {
        const baseId = item.id.split('-season-')[0];
        if (baseId === id) return true;
      }
      if (item.movie && item.movie.content_id === id) return true;
      if (item.web_series && item.web_series.content_id === id) return true;
      if (item.show && (item.show.id === id || item.show.content_id === id)) return true;
      if (typeof id === 'string' && id.includes('-season-')) {
        const baseSearchId = id.split('-season-')[0];
        if (item.id === baseSearchId || item.content_id === baseSearchId) return true;
      }
      return false;
    });
  }, [allContent, id, location.state]);

  // Extract season from URL if present
  useEffect(() => {
    if (id && typeof id === 'string' && id.includes('-season-')) {
      const seasonMatch = id.match(/-season-(\d+)$/);
      if (seasonMatch) {
        setSelectedSeason(parseInt(seasonMatch[1], 10));
      }
    } else if (content?.seasonNumber) {
      setSelectedSeason(content.seasonNumber);
    }
  }, [id, content]);

  // Fetch episode data
  useEffect(() => {
    const fetchEpisodeData = async () => {
      if (content?.content_type === 'Web Series') {
        if (content.web_series?.season_id_list && content.web_series.season_id_list.length > 0) {
          const { supabase } = await import('@/integrations/supabase/client');
          const seasonId = content.web_series.season_id_list[selectedSeason - 1];

          if (seasonId) {
            try {
              const { data: seasonData, error: seasonError } = await supabase
                .from('season')
                .select('*')
                .eq('season_id', seasonId)
                .single();

              if (!seasonError && seasonData) {
                setCurrentSeasonDetails(seasonData);

                if (seasonData.episode_id_list) {
                  const episodes = [];

                  for (const episodeId of seasonData.episode_id_list) {
                    try {
                      const { data: episodeData, error } = await supabase
                        .from('episode')
                        .select('*')
                        .eq('episode_id', episodeId)
                        .single();

                      if (!error && episodeData) {
                        episodes.push({
                          id: episodeData.episode_id,
                          title: episodeData.title || `Episode ${episodes.length + 1}`,
                          description: episodeData.description || 'No description available',
                          duration: episodeData.duration || null,
                          thumbnail_url: episodeData.thumbnail_url || null
                        });
                      }
                    } catch (err) {
                      console.error('Error fetching episode:', err);
                    }
                  }

                  setCurrentSeasonEpisodes(episodes);
                }
              }
            } catch (err) {
              console.error('Error fetching season data:', err);
            }
          }
        } else if (content.web_series?.seasons && content.web_series.seasons.length > 0) {
          const seasonData = content.web_series.seasons[selectedSeason - 1];
          if (seasonData) {
            setCurrentSeasonDetails(seasonData);

            if (seasonData.episodes && Array.isArray(seasonData.episodes)) {
              const episodes = seasonData.episodes.map((episode, index) => ({
                id: episode.episode_id || `episode-${index + 1}`,
                title: episode.title || `Episode ${index + 1}`,
                description: episode.description || 'No description available',
                duration: episode.duration || null,
                thumbnail_url: episode.thumbnail_url || null
              }));
              setCurrentSeasonEpisodes(episodes);
            }
          }
        }
      } else if (content?.content_type === 'Show' && content.show?.episode_id_list) {
        setCurrentSeasonDetails(null);

        const { supabase } = await import('@/integrations/supabase/client');
        const episodes = [];

        for (const episodeId of content.show.episode_id_list) {
          try {
            const { data: episodeData, error } = await supabase
              .from('episode')
              .select('*')
              .eq('episode_id', episodeId)
              .single();

            if (!error && episodeData) {
              episodes.push({
                id: episodeData.episode_id,
                title: episodeData.title || `Episode ${episodes.length + 1}`,
                description: episodeData.description || 'No description available',
                duration: episodeData.duration || null,
                thumbnail_url: episodeData.thumbnail_url || null
              });
            }
          } catch (err) {
            console.error('Error fetching episode:', err);
          }
        }

        setCurrentSeasonEpisodes(episodes.reverse());
      } else {
        setCurrentSeasonDetails(null);
      }
    };

    fetchEpisodeData();
    setShowAllDetails(false);
  }, [content, selectedSeason]);

  // Get content details
  const getContentDetails = React.useMemo(() => {
    if (!content) {
      return {
        description: '',
        release_year: null,
        rating_type: null,
        rating: null,
        duration: null,
        directors: [],
        writers: [],
        cast: [],
        thumbnail_url: '',
        trailer_url: '',
        genres: []
      };
    }

    if (content.content_type === 'Movie' && content.movie) {
      return {
        description: content.movie.description,
        release_year: content.movie.release_year,
        rating_type: content.movie.rating_type,
        rating: content.movie.rating,
        duration: content.movie.duration,
        directors: content.movie.director || [],
        writers: content.movie.writer || [],
        cast: content.movie.cast_members || [],
        thumbnail_url: content.movie.thumbnail_url,
        trailer_url: content.movie.trailer_url,
        genres: content.genre || []
      };
    } else if (content.content_type === 'Web Series') {
      if (currentSeasonDetails) {
        return {
          description: currentSeasonDetails.season_description || '',
          release_year: currentSeasonDetails.release_year || new Date().getFullYear(),
          rating_type: currentSeasonDetails.rating_type || 'Not Rated',
          rating: currentSeasonDetails.rating || 0,
          duration: null,
          directors: currentSeasonDetails.director || [],
          writers: currentSeasonDetails.writer || [],
          cast: currentSeasonDetails.cast_members || [],
          thumbnail_url: currentSeasonDetails.thumbnail_url || '',
          trailer_url: currentSeasonDetails.trailer_url || '',
          genres: content.genre || []
        };
      }

      if (content.web_series?.seasons && content.web_series.seasons.length > 0) {
        const season = content.web_series.seasons[selectedSeason - 1] || content.web_series.seasons[0];
        return {
          description: season.season_description || '',
          release_year: season.release_year || new Date().getFullYear(),
          rating_type: season.rating_type || 'Not Rated',
          rating: season.rating || 0,
          duration: null,
          directors: season.director || [],
          writers: season.writer || [],
          cast: season.cast_members || [],
          thumbnail_url: season.thumbnail_url || '',
          trailer_url: season.trailer_url || '',
          genres: content.genre || []
        };
      } else {
        return {
          description: content.web_series?.description || '',
          release_year: content.web_series?.release_year || new Date().getFullYear(),
          rating_type: content.web_series?.rating_type || 'Not Rated',
          rating: content.web_series?.rating || 0,
          duration: null,
          directors: content.web_series?.directors || [],
          writers: content.web_series?.writers || [],
          cast: content.web_series?.cast_members || [],
          thumbnail_url: content.web_series?.thumbnail_url || '',
          trailer_url: content.web_series?.trailer_url || '',
          genres: content.genre || []
        };
      }
    } else if (content.content_type === 'Show' && content.show) {
      return {
        description: content.show.description,
        release_year: content.show.release_year,
        rating_type: content.show.rating_type,
        rating: content.show.rating,
        duration: null,
        directors: content.show.directors || [],
        writers: content.show.writers || [],
        cast: content.show.cast_members || [],
        thumbnail_url: content.show.thumbnail_url,
        trailer_url: content.show.trailer_url,
        genres: content.show.genres || content.genre || []
      };
    }

    return {
      description: '',
      release_year: null,
      rating_type: null,
      rating: null,
      duration: null,
      directors: [],
      writers: [],
      cast: [],
      thumbnail_url: '',
      trailer_url: '',
      genres: []
    };
  }, [content, selectedSeason, currentSeasonDetails]);

  const details = getContentDetails;

  if (isLoading || !adsLoaded) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="pt-20">
          <div className="container mx-auto px-6 py-8">
            <div className="flex items-center justify-center h-96">
              <div className="text-center">
                <div className="text-lg mb-4">
                  {isLoading ? 'Loading content...' : 'Loading advertisements...'}
                </div>
                {!adsLoaded && (
                  <div className="text-sm text-gray-400">
                    Preparing ad content...
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="pt-20">
          <div className="container mx-auto px-6 py-8">
            <div className="flex items-center justify-center h-96">
              <div className="text-center">
                <div className="text-lg mb-4">Content not found</div>
                <div className="text-sm text-gray-400">ID: {id}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handlePlayClick = (episodeId?: string) => {
    if (!content || !content.content_id) {
      console.error('Invalid content data, cannot navigate to player');
      return;
    }

    try {
      if (content.content_type === 'Movie') {
        navigate(`/player/${content.content_id}`, { state: content, replace: false });
      } else if (episodeId) {
        navigate(`/player/${content.content_id}?episode=${episodeId}`, { state: content, replace: false });
      } else {
        if (content.content_type === 'Web Series' && currentSeasonEpisodes.length > 0) {
          const firstEpisodeId = currentSeasonEpisodes[0].id;
          navigate(`/player/${content.content_id}?episode=${firstEpisodeId}`, { state: content, replace: false });
        } else if (content.content_type === 'Show' && content.show?.episode_id_list?.length > 0) {
          const firstEpisodeId = content.show.episode_id_list[0];
          navigate(`/player/${content.content_id}?episode=${firstEpisodeId}`, { state: content, replace: false });
        } else {
          navigate(`/player/${content.content_id}`, { state: content, replace: false });
        }
      }
    } catch (error) {
      console.error('Navigation error:', error);
    }
  };

  const handleTrailerClick = () => {
    setIsTrailerModalOpen(true);
  };

  const getCountInfo = () => {
    if (content.content_type === 'Web Series') {
      if (content.web_series?.season_id_list) {
        const seasonCount = content.web_series.season_id_list.length;
        return `${seasonCount} Season${seasonCount > 1 ? 's' : ''}`;
      } else if (content.web_series?.seasons) {
        const seasonCount = content.web_series.seasons.length;
        return `${seasonCount} Season${seasonCount > 1 ? 's' : ''}`;
      }
    } else if (content.content_type === 'Show' && content.show?.episode_id_list) {
      const episodeCount = content.show.episode_id_list.length;
      return `${episodeCount} Episode${episodeCount > 1 ? 's' : ''}`;
    }
    return null;
  };

  return (
    <div className="min-h-screen">
      <Header />

      <TrailerModal
        isOpen={isTrailerModalOpen}
        onClose={() => setIsTrailerModalOpen(false)}
        trailerUrl={details.trailer_url || ''}
        title={content?.title || 'Content'}
      />

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
            {/* Content Details Card */}
            <Card className="bg-gradient-to-br from-black/90 via-[#0A7D4B]/20 to-black/90 backdrop-blur-sm border border-border/50 wave-transition relative overflow-hidden">
              <div className="absolute inset-0">
                <div className="player-wave-bg-1"></div>
                <div className="player-wave-bg-2"></div>
                <div className="player-wave-bg-3"></div>
              </div>

              <CardContent className="p-8 relative z-10">
                {content.content_type === 'Movie' ? (
                  <div className="space-y-6">
                    <div className="absolute top-8 right-8">
                      <div className="bg-gradient-to-r from-yellow-600/90 to-yellow-700/90 backdrop-blur-sm border border-yellow-500/50 rounded-lg px-4 py-2 shadow-lg">
                        <span className="text-yellow-100 text-sm font-bold">Movie</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <div 
                          className="relative overflow-hidden rounded-lg cursor-pointer group aspect-[16/9]"
                          onClick={() => handlePlayClick()}
                        >
                          <img
                            src={details.thumbnail_url || '/placeholder.svg'}
                            alt={content.title}
                            className="w-full h-full object-cover rounded-lg border border-primary/20 shadow-2xl"
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-300 flex items-center justify-center">
                            <Play className="w-16 h-16 text-white opacity-0 group-hover:opacity-70 transition-opacity duration-300" />
                          </div>
                        </div>

                        <div className="space-y-3">
                          <Button 
                            onClick={() => handlePlayClick()}
                            className="w-full bg-primary/10 backdrop-blur-sm border border-primary/50 text-primary hover:bg-gradient-to-br hover:from-black/60 hover:via-[#0A7D4B]/10 hover:to-black/60 hover:border-primary/30 transition-all duration-300"
                          >
                            <Play className="w-5 h-5 mr-2" />
                            Play
                          </Button>
                          <Button 
                            onClick={handleTrailerClick}
                            variant="outline"
                            className="w-full bg-primary/5 backdrop-blur-sm border border-primary/30 text-primary hover:bg-gradient-to-br hover:from-black/30 hover:via-[#0A7D4B]/5 hover:to-black/30 hover:border-primary/20 transition-all duration-300"
                          >
                            <ExternalLink className="w-5 h-5 mr-2" />
                            Trailer
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-6 pr-16 pt-12">
                        <h1 className="text-3xl font-bold text-foreground">{content.title}</h1>

                        <div className="flex items-center space-x-3 flex-wrap">
                          {details.rating_type && (
                            <span className="bg-primary/20 text-primary px-2 py-1 rounded-md border border-primary/30 text-xs font-medium">
                              {details.rating_type}
                            </span>
                          )}
                          {details.rating && (
                            <div className="flex items-center space-x-1">
                              <Star className="h-3 w-3 text-yellow-400 fill-current" />
                              <span className="text-foreground text-xs font-medium">
                                {details.rating}
                              </span>
                            </div>
                          )}
                          {details.release_year && (
                            <span className="text-muted-foreground text-xs font-medium">
                              {details.release_year}
                            </span>
                          )}
                          {details.duration && (
                            <span className="text-muted-foreground text-xs font-medium">
                              {details.duration} min
                            </span>
                          )}
                        </div>

                        <div className="space-y-4">
                          {!showAllDetails && details.description && (
                            <p className="text-muted-foreground text-sm leading-relaxed line-clamp-3">
                              {details.description}
                            </p>
                          )}

                          <button 
                            onClick={() => setShowAllDetails(!showAllDetails)}
                            className="text-primary hover:text-primary/80 text-sm font-medium bg-transparent border-none p-0 cursor-pointer transition-colors duration-300 animate-pulse"
                          >
                            {showAllDetails ? 'Show Less' : 'See More'}
                          </button>

                          {showAllDetails && (
                            <div className="space-y-4 animate-in slide-in-from-top-5 duration-300">
                              {details.description && (
                                <div>
                                  <h4 className="text-sm font-semibold text-foreground mb-2">Description</h4>
                                  <p className="text-muted-foreground text-sm leading-relaxed">
                                    {details.description}
                                  </p>
                                </div>
                              )}

                              {details.directors.length > 0 && (
                                <div>
                                  <h4 className="text-sm font-semibold text-foreground mb-2">Directors</h4>
                                  <p className="text-muted-foreground text-sm">
                                    {details.directors.join(', ')}
                                  </p>
                                </div>
                              )}

                              {details.writers.length > 0 && (
                                <div>
                                  <h4 className="text-sm font-semibold text-foreground mb-2">Writers</h4>
                                  <p className="text-muted-foreground text-sm">
                                    {details.writers.join(', ')}
                                  </p>
                                </div>
                              )}

                              {details.cast.length > 0 && (
                                <div>
                                  <h4 className="text-sm font-semibold text-foreground mb-2">Cast</h4>
                                  <p className="text-muted-foreground text-sm">
                                    {details.cast.join(', ')}
                                  </p>
                                </div>
                              )}

                              {details.genres.length > 0 && (
                                <div>
                                  <h4 className="text-sm font-semibold text-foreground mb-2">Genres</h4>
                                  <div className="flex flex-wrap gap-2">
                                    {details.genres.map((genre, index) => {
                                      const genreColors = {
                                        'Action': 'bg-red-500/20 text-red-300 border-red-500/30',
                                        'Adventure': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
                                        'Comedy': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
                                        'Drama': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
                                        'Horror': 'bg-gray-500/20 text-gray-300 border-gray-500/30',
                                        'Thriller': 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
                                        'Sci-Fi': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
                                        'Fantasy': 'bg-violet-500/20 text-violet-300 border-violet-500/30',
                                        'Romance': 'bg-pink-500/20 text-pink-300 border-pink-500/30',
                                        'Crime': 'bg-slate-500/20 text-slate-300 border-slate-500/30',
                                        'Family': 'bg-green-500/20 text-green-300 border-green-500/30'
                                      };
                                      const colorClass = genreColors[genre] || 'bg-primary/20 text-primary border-primary/30';
                                      return (
                                        <span key={index} className={`px-2 py-1 rounded-md text-xs font-medium border ${colorClass}`}>
                                          {genre}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="space-y-6 relative">
                      <div className="pr-32 pt-12">
                        <div className="relative overflow-hidden rounded-lg aspect-[16/9]">
                          <img
                            key={`${content.content_id}-${selectedSeason}-${details.thumbnail_url}`}
                            src={details.thumbnail_url || '/placeholder.svg'}
                            alt={content.title}
                            className="w-full h-full object-cover rounded-lg border border-primary/20 shadow-2xl"
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        {content.content_type !== 'Web Series' && content.content_type !== 'Show' && (
                          <Button 
                            onClick={() => handlePlayClick()}
                            className="w-full bg-primary/10 backdrop-blur-sm border border-primary/50 text-primary hover:bg-gradient-to-br hover:from-black/60 hover:via-[#0A7D4B]/10 hover:to-black/60 hover:border-primary/30 transition-all duration-300"
                          >
                            <Play className="w-5 h-5 mr-2" />
                            Play
                          </Button>
                        )}
                        <Button 
                          onClick={handleTrailerClick}
                          variant="outline"
                          className="w-full bg-primary/5 backdrop-blur-sm border border-primary/30 text-primary hover:bg-gradient-to-br hover:from-black/30 hover:via-[#0A7D4B]/5 hover:to-black/30 hover:border-primary/20 transition-all duration-300"
                        >
                          <ExternalLink className="w-5 h-5 mr-2" />
                          Trailer
                        </Button>
                      </div>

                      <div key={`details-${content.content_id}-${selectedSeason}-${details.rating_type}-${details.rating}`} className="space-y-4">
                        <h1 className="text-3xl font-bold text-foreground">{content.title}</h1>

                        <div className="flex items-center space-x-3 flex-wrap">
                          {details.rating_type && (
                            <span className="bg-primary/20 text-primary px-2 py-1 rounded-md border border-primary/30 text-xs font-medium">
                              {details.rating_type}
                            </span>
                          )}
                          {details.rating && (
                            <div className="flex items-center space-x-1">
                              <Star className="h-3 w-3 text-yellow-400 fill-current" />
                              <span className="text-foreground text-xs font-medium">
                                {details.rating}
                              </span>
                            </div>
                          )}
                          {details.release_year && (
                            <span className="text-muted-foreground text-xs font-medium">
                              {details.release_year}
                            </span>
                          )}
                          {content.content_type === 'Web Series' && (
                            <span className="bg-gradient-to-r from-blue-500/20 to-blue-600/20 text-blue-300 px-2 py-1 rounded-md border border-blue-500/30 text-xs font-medium">
                              Season {selectedSeason}
                            </span>
                          )}
                          {details.duration && (
                            <span className="text-muted-foreground text-xs font-medium">
                              {details.duration}
                            </span>
                          )}
                        </div>

                        <div className="space-y-4">
                          {!showAllDetails && details.description && (
                            <p className="text-muted-foreground text-sm leading-relaxed line-clamp-3">
                              {details.description}
                            </p>
                          )}

                          <button 
                            onClick={() => setShowAllDetails(!showAllDetails)}
                            className="text-primary hover:text-primary/80 text-sm font-medium bg-transparent border-none p-0 cursor-pointer transition-colors duration-300 animate-pulse"
                          >
                            {showAllDetails ? 'Show Less' : 'See More'}
                          </button>

                          {showAllDetails && (
                            <div className="space-y-4 animate-in slide-in-from-top-5 duration-300">
                              {details.description && (
                                <div>
                                  <h4 className="text-sm font-semibold text-foreground mb-2">Description</h4>
                                  <p className="text-muted-foreground text-sm leading-relaxed">
                                    {details.description}
                                  </p>
                                </div>
                              )}

                              {details.directors.length > 0 && (
                                <div>
                                  <h4 className="text-sm font-semibold text-foreground mb-2">Directors</h4>
                                  <p className="text-muted-foreground text-sm">
                                    {details.directors.join(', ')}
                                  </p>
                                </div>
                              )}

                              {details.writers.length > 0 && (
                                <div>
                                  <h4 className="text-sm font-semibold text-foreground mb-2">Writers</h4>
                                  <p className="text-muted-foreground text-sm">
                                    {details.writers.join(', ')}
                                  </p>
                                </div>
                              )}

                              {details.cast.length > 0 && (
                                <div>
                                  <h4 className="text-sm font-semibold text-foreground mb-2">Cast</h4>
                                  <p className="text-muted-foreground text-sm">
                                    {details.cast.join(', ')}
                                  </p>
                                </div>
                              )}

                              {details.genres.length > 0 && (
                                <div>
                                  <h4 className="text-sm font-semibold text-foreground mb-2">Genres</h4>
                                  <div className="flex flex-wrap gap-2">
                                    {details.genres.map((genre, index) => {
                                      const genreColors = {
                                        'Action': 'bg-red-500/20 text-red-300 border-red-500/30',
                                        'Adventure': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
                                        'Comedy': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
                                        'Drama': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
                                        'Horror': 'bg-gray-500/20 text-gray-300 border-gray-500/30',
                                        'Thriller': 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
                                        'Sci-Fi': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
                                        'Fantasy': 'bg-violet-500/20 text-violet-300 border-violet-500/30',
                                        'Romance': 'bg-pink-500/20 text-pink-300 border-pink-500/30',
                                        'Crime': 'bg-slate-500/20 text-slate-300 border-slate-500/30',
                                        'Family': 'bg-green-500/20 text-green-300 border-green-500/30'
                                      };
                                      const colorClass = genreColors[genre] || 'bg-primary/20 text-primary border-primary/30';
                                      return (
                                        <span key={index} className={`px-2 py-1 rounded-md text-xs font-medium border ${colorClass}`}>
                                          {genre}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div key={`season-${selectedSeason}-${content.content_id}`} className="space-y-6 relative">
                      <div className="absolute top-0 right-0 flex items-center gap-3 z-10">
                        {getCountInfo() && (
                          <div className="bg-gradient-to-r from-primary/20 to-primary/30 backdrop-blur-sm border border-primary/40 rounded-lg px-3 py-2 shadow-lg">
                            <span className="text-primary text-sm font-medium">
                              {getCountInfo()}
                            </span>
                          </div>
                        )}
                        <div className="bg-gradient-to-r from-yellow-600/90 to-yellow-700/90 backdrop-blur-sm border border-yellow-500/50 rounded-lg px-4 py-2 shadow-lg">
                          <span className="text-yellow-100 text-sm font-bold">
                            {content.content_type === 'Show' ? 'TV Show' : content.content_type}
                          </span>
                        </div>
                      </div>

                      <div className="h-16"></div>

                      {content.content_type === 'Web Series' && content.web_series?.season_id_list && (
                        <div className="mb-6">
                          <div className="relative">
                            <button
                              onClick={() => setIsSeasonDropdownOpen(!isSeasonDropdownOpen)}
                              className="flex items-center justify-between w-full p-3 bg-gradient-to-br from-black/90 via-[#0A7D4B]/20 to-black/90 backdrop-blur-sm border border-primary/30 rounded-lg text-left text-primary hover:bg-gradient-to-br hover:from-black/80 hover:via-[#0A7D4B]/30 hover:to-black/80 transition-all duration-300"
                            >
                              <span>Season {selectedSeason}</span>
                              <ChevronDown className={`w-5 h-5 transition-transform ${isSeasonDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isSeasonDropdownOpen && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => setIsSeasonDropdownOpen(false)} />
                                <div 
                                  className="absolute top-full left-0 right-0 z-50 bg-gradient-to-br from-black/95 via-[#0A7D4B]/25 to-black/95 backdrop-blur-sm border border-primary/30 rounded-lg mt-1 max-h-48 overflow-y-auto shadow-2xl"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {content.web_series.season_id_list.map((seasonId, index) => (
                                    <button
                                      key={seasonId}
                                      onClick={() => {
                                        const newSeason = index + 1;
                                        setSelectedSeason(newSeason);
                                        setIsSeasonDropdownOpen(false);
                                        setShowAllDetails(false);
                                        setCurrentSeasonEpisodes([]);
                                      }}
                                      className={`w-full p-3 text-left transition-all duration-300 first:rounded-t-lg last:rounded-b-lg ${
                                        selectedSeason === index + 1 
                                          ? 'bg-gradient-to-r from-[#0A7D4B]/40 to-[#0A7D4B]/60 text-primary border-l-4 border-primary' 
                                          : 'text-primary hover:bg-gradient-to-r hover:from-[#0A7D4B]/20 hover:to-[#0A7D4B]/30'
                                      }`}
                                    >
                                      Season {index + 1}
                                    </button>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      )}

                      {currentSeasonEpisodes.length > 0 && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-foreground">
                              {content.content_type === 'Web Series' ? 'Episodes' : 'Latest Episodes'}
                            </h3>
                            <span className="text-sm text-muted-foreground">
                              {currentSeasonEpisodes.length} episode{currentSeasonEpisodes.length > 1 ? 's' : ''}
                            </span>
                          </div>
                          <div className={`space-y-2 ${currentSeasonEpisodes.length > 7 ? 'max-h-96 overflow-y-auto pr-2' : ''}`}>
                            {currentSeasonEpisodes.slice(0, currentSeasonEpisodes.length > 7 ? currentSeasonEpisodes.length : 7).map((episode, index) => (
                              <div
                                key={episode.id}
                                onClick={() => handlePlayClick(episode.id)}
                                className="p-3 bg-primary/5 backdrop-blur-sm border border-primary/20 rounded-lg cursor-pointer hover:bg-primary/10 hover:border-primary/30 transition-all duration-300"
                              >
                                <div className="flex gap-3">
                                  <div className="flex-shrink-0 relative overflow-hidden rounded-md">
                                    <img
                                      src={episode.thumbnail_url || '/placeholder.svg'}
                                      alt={episode.title}
                                      className="w-24 h-16 object-cover object-center"
                                    />
                                    <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-30 transition-all duration-300 flex items-center justify-center">
                                      <Play className="w-4 h-4 text-white opacity-0 hover:opacity-70 transition-opacity duration-300" />
                                    </div>
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-medium text-foreground truncate">{episode.title}</h4>
                                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">{episode.description}</p>
                                    {episode.duration && (
                                      <p className="text-xs text-muted-foreground/70 mt-1">
                                        Duration: {episode.duration} min
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Advertisement Section */}
            <div className="w-full">
              <Card className="bg-gradient-to-br from-black/40 via-[#0A7D4B]/10 to-black/40 backdrop-blur-sm border border-border/30">
                <CardContent className="p-4 sm:p-6 space-y-6 sm:space-y-8">
                  {/* First Ad - Mobile Banner */}
                  <div className="w-full flex justify-center">
                    <div 
                      id="details-ad-1" 
                      className="w-full max-w-md bg-gradient-to-r from-cyan-600/20 to-blue-600/20 border border-cyan-500/30 rounded-lg p-4 text-center cursor-pointer hover:from-cyan-600/30 hover:to-blue-600/30 transition-all duration-300"
                      style={{ minHeight: '80px' }}
                      dangerouslySetInnerHTML={{
                        __html: `
                          <a href="https://adsterra.com" target="_blank" style="text-decoration: none; color: inherit; display: block;">
                            <div style="font-size: 16px; font-weight: bold; color: #22d3ee; margin-bottom: 4px;">
                              📱 Mobile Streaming App
                            </div>
                            <div style="font-size: 12px; color: #94a3b8;">
                              Download now for the best experience!
                            </div>
                          </a>
                        `
                      }}
                    />
                  </div>

                  {/* Second Ad - Banner */}
                  <div className="w-full flex justify-center">
                    <div 
                      id="details-ad-2" 
                      className="w-full max-w-lg bg-gradient-to-r from-emerald-600/20 to-green-600/20 border border-emerald-500/30 rounded-lg p-4 text-center cursor-pointer hover:from-emerald-600/30 hover:to-green-600/30 transition-all duration-300"
                      style={{ minHeight: '90px' }}
                      dangerouslySetInnerHTML={{
                        __html: `
                          <a href="https://adsterra.com" target="_blank" style="text-decoration: none; color: inherit; display: block;">
                            <div style="font-size: 17px; font-weight: bold; color: #10b981; margin-bottom: 6px;">
                              🎭 Exclusive Content Library
                            </div>
                            <div style="font-size: 13px; color: #94a3b8;">
                              Access thousands of movies and shows
                            </div>
                          </a>
                        `
                      }}
                    />
                  </div>

                  {/* Third Ad - Tall Skyscraper */}
                  <div className="w-full flex justify-center">
                    <div 
                      id="details-ad-3" 
                      className="w-full max-w-xs bg-gradient-to-b from-violet-600/20 to-purple-600/20 border border-violet-500/30 rounded-lg p-6 text-center cursor-pointer hover:from-violet-600/30 hover:to-purple-600/30 transition-all duration-300"
                      style={{ minHeight: '650px' }}
                      dangerouslySetInnerHTML={{
                        __html: `
                          <a href="https://adsterra.com" target="_blank" style="text-decoration: none; color: inherit; display: block; height: 100%;">
                            <div style="font-size: 18px; font-weight: bold; color: #8b5cf6; margin-bottom: 20px;">
                              🌟 Premium Features
                            </div>
                            <div style="font-size: 13px; color: #94a3b8; margin-bottom: 24px; line-height: 1.5;">
                              Unlock the full potential of your streaming experience with our premium features.
                            </div>
                            <div style="background: rgba(139, 92, 246, 0.2); padding: 16px; border-radius: 12px; margin-bottom: 24px;">
                              <div style="font-size: 15px; color: #8b5cf6; font-weight: bold; margin-bottom: 8px;">
                                ✓ 4K Ultra HD
                              </div>
                              <div style="font-size: 15px; color: #8b5cf6; font-weight: bold; margin-bottom: 8px;">
                                ✓ No Ads Experience
                              </div>
                              <div style="font-size: 15px; color: #8b5cf6; font-weight: bold; margin-bottom: 8px;">
                                ✓ Offline Downloads
                              </div>
                              <div style="font-size: 15px; color: #8b5cf6; font-weight: bold;">
                                ✓ Multiple Devices
                              </div>
                            </div>
                            <div style="background: linear-gradient(45deg, #8b5cf6, #a855f7); padding: 12px 24px; border-radius: 8px; margin-bottom: 16px;">
                              <div style="font-size: 14px; color: white; font-weight: bold;">
                                START FREE TRIAL
                              </div>
                            </div>
                            <div style="font-size: 11px; color: #64748b;">
                              30 days free, then $9.99/month
                            </div>
                          </a>
                        `
                      }}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {adsLoaded && <AutoClickAd pageType="details" />}
    </div>
  );
};

export default Details;