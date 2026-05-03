import { useState, useEffect } from "react";
import { useGetMyProfile, useUpdateMyProfile, getGetMyProfileQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, User, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function Profile() {
  const { isAuthenticated } = useAuth();
  const { data: profile, isLoading } = useGetMyProfile({
    query: { enabled: isAuthenticated },
  });
  
  const updateProfile = useUpdateMyProfile();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    firstName: "", lastName: "", bio: "", phone: "", location: "", agencyName: ""
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        firstName: profile.firstName || "",
        lastName: profile.lastName || "",
        bio: profile.bio || "",
        phone: profile.phone || "",
        location: profile.location || "",
        agencyName: profile.agencyName || ""
      });
    }
  }, [profile]);

  const handleSave = () => {
    updateProfile.mutate({ data: formData }, {
      onSuccess: (updated) => {
        toast({ title: "Profile updated successfully" });
        queryClient.setQueryData(getGetMyProfileQueryKey(), updated);
      },
      onError: () => {
        toast({ title: "Failed to update profile", variant: "destructive" });
      }
    });
  };

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!profile) return null;

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary">
          <User className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-3xl font-serif font-bold">Your Profile</h1>
          <p className="text-muted-foreground capitalize">{profile.role} Account • {profile.email}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>Update your contact details and public profile.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>First Name</Label>
              <Input 
                value={formData.firstName} 
                onChange={e => setFormData({...formData, firstName: e.target.value})} 
              />
            </div>
            <div className="space-y-2">
              <Label>Last Name</Label>
              <Input 
                value={formData.lastName} 
                onChange={e => setFormData({...formData, lastName: e.target.value})} 
              />
            </div>
          </div>
          
          {profile.role === "agency" && (
            <div className="space-y-2">
              <Label>Agency Name</Label>
              <Input 
                value={formData.agencyName} 
                onChange={e => setFormData({...formData, agencyName: e.target.value})} 
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input 
                value={formData.phone} 
                onChange={e => setFormData({...formData, phone: e.target.value})} 
              />
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input 
                value={formData.location} 
                onChange={e => setFormData({...formData, location: e.target.value})} 
                placeholder="City, Country"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Bio / Experience</Label>
            <Textarea 
              value={formData.bio} 
              onChange={e => setFormData({...formData, bio: e.target.value})} 
              rows={4}
              placeholder={profile.role === "agency" ? "Tell trekkers about your agency's history..." : "Tell agencies about your trekking experience..."}
            />
          </div>

          <Button onClick={handleSave} disabled={updateProfile.isPending} className="w-full">
            {updateProfile.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Save className="w-4 h-4 mr-2"/>}
            Save Changes
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}